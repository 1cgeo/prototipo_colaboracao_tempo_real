// Path: controllers\sync.controller.ts

import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { compressFeatures, compressFeature } from '../utils/geometryCompression.js';
import { FeatureHistory } from '../types/history.types.js';

// Constants for pagination limits
const MAX_PAGE_SIZE = 500; // Maximum number of items per page
const DEFAULT_PAGE_SIZE = 100; // Default page size
const MAX_TOTAL_ITEMS = 10000; // Maximum total items to fetch

/**
 * Get all updates for a map since a specific timestamp
 * Combines features, comments, and history into a single response
 */
export const getMapUpdates = async (req: Request, res: Response): Promise<void> => {
  try {
    const mapId = parseInt(req.params.mapId, 10);
    
    // Parse query parameters with defaults and enforce limits
    const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
    
    // Sanitize and limit pagination parameters
    let page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    let limit = req.query.limit ? parseInt(req.query.limit as string, 10) : DEFAULT_PAGE_SIZE;
    
    // Enforce positive page number
    page = Math.max(1, page);
    
    // Enforce maximum page size
    limit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
    
    const includeHistory = req.query.history === 'true';
    
    // Optional viewport filtering
    let viewport = null;
    if (req.query.viewport) {
      try {
        viewport = JSON.parse(req.query.viewport as string);
      } catch (e) {
        console.error("[API] Invalid viewport JSON:", e);
        res.status(400).json({ error: 'Invalid viewport format' });
        return;
      }
    }
    
    // Validate viewport parameters if provided
    if (viewport) {
      const { minLng, minLat, maxLng, maxLat } = viewport;
      if (typeof minLng !== 'number' || typeof minLat !== 'number' || 
          typeof maxLng !== 'number' || typeof maxLat !== 'number') {
        res.status(400).json({ error: 'Invalid viewport coordinates' });
        return;
      }
      
      // Validate coordinate ranges
      if (minLng < -180 || minLng > 180 || maxLng < -180 || maxLng > 180 ||
          minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
        res.status(400).json({ error: 'Viewport coordinates out of range' });
        return;
      }
    }
    
    console.log(`[API] Map ${mapId} sync requested since ${new Date(since).toISOString()}`);
    console.log(`[API] Options: page=${page}, limit=${limit}, viewport=${!!viewport}, history=${includeHistory}`);
    
    // Prepare response structure
    const response: any = {
      timestamp: Date.now(),
      data: {
        features: [],
        comments: [],
        deletedFeatures: [],
      },
      pagination: {
        page,
        limit,
        hasMore: false
      }
    };
    
    // Check for excessive total items to prevent DoS attacks
    const featureCount = await db.getUpdatedFeaturesCount(mapId, since);
    if (featureCount > MAX_TOTAL_ITEMS) {
      console.warn(`[API] Excessive data request: ${featureCount} items for map ${mapId}. Consider using more filters or reducing time range.`);
      
      // We'll still proceed, but limit the result set
      response.warnings = [`Large dataset (${featureCount} items) detected. Consider using viewport filtering or narrower time range.`];
    }
    
    // Get updated features (with optional viewport filtering)
    if (viewport) {
      const { minLng, minLat, maxLng, maxLat } = viewport;
      
      // Get features in viewport updated since timestamp
      response.data.features = await db.getFeaturesInViewportSince(
        mapId, minLng, minLat, maxLng, maxLat, since, page, limit
      );
    } else {
      // Get all features updated since timestamp
      response.data.features = await db.getUpdatedFeatures(
        mapId, since, page, limit
      );
    }
    
    // Get comments updated since timestamp
    response.data.comments = await db.getUpdatedComments(mapId, since, page, limit);
    
    // Get history of deleted features
    if (includeHistory) {
      const history = await db.getMapHistorySince(mapId, since, page, limit);
      response.data.history = history;
      
      // Extract deleted feature IDs
      response.data.deletedFeatures = history
        .filter((entry: FeatureHistory) => entry.operation === 'delete')
        .map((entry: FeatureHistory) => entry.feature_id)
        .filter((id: string | null) => id !== null);
    } else {
      // Just get deleted feature IDs
      response.data.deletedFeatures = await db.getDeletedFeaturesSince(mapId, since);
    }
    
    // Check for more data (pagination)
    const totalPages = Math.ceil(featureCount / limit);
    response.pagination.hasMore = page < totalPages;
    response.pagination.totalPages = totalPages;
    response.pagination.totalItems = featureCount;
    
    // Apply geometry compression to reduce data size
    response.data.features = compressFeatures(response.data.features);
    
    console.log(`[API] Sync response prepared: ${response.data.features.length} features, ` +
                `${response.data.comments.length} comments, ` +
                `${response.data.deletedFeatures.length} deleted features`);
    
    res.json(response);
  } catch (error) {
    console.error('[API] Error fetching map updates:', error);
    res.status(500).json({ error: 'Failed to fetch map updates' });
  }
};

/**
 * Get detailed changes for a specific feature
 * For resolving conflicts by retrieving the latest state
 */
export const getFeatureUpdates = async (req: Request, res: Response): Promise<void> => {
  try {
    const featureId = req.params.id;
    
    console.log(`[API] Fetching latest state for feature ${featureId}`);
    
    const feature = await db.getFeature(featureId);
    
    if (!feature) {
      console.log(`[API] Feature ${featureId} not found`);
      res.status(404).json({ error: 'Feature not found' });
      return;
    }
    
    // Check if feature was deleted and exists only in history
    const isDeleted = await db.isFeatureDeleted(featureId);
    
    if (isDeleted) {
      console.log(`[API] Feature ${featureId} was deleted`);
      res.json({
        id: featureId,
        isDeleted: true,
        timestamp: Date.now()
      });
      return;
    }
    
    // Apply geometry compression
    const compressedFeature = compressFeature(feature);
    
    res.json({
      feature: compressedFeature,
      isDeleted: false,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[API] Error fetching feature updates:', error);
    res.status(500).json({ error: 'Failed to fetch feature updates' });
  }
};