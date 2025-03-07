// controllers/feature-history.controller.ts

import { Request, Response } from 'express';
import { db } from '../config/database.js';

/**
 * Get history for a specific feature
 */
export const getFeatureHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const featureId = parseInt(req.params.id, 10);
    console.log(`[API] Fetching history for feature ${featureId}`);
    
    const history = await db.getFeatureHistory(featureId);
    console.log(`[API] Found ${history.length} history entries for feature ${featureId}`);
    
    res.json(history);
  } catch (error) {
    console.error('[API] Error fetching feature history:', error);
    res.status(500).json({ error: 'Failed to fetch feature history' });
  }
};

/**
 * Get history for a map
 */
export const getMapHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const mapId = parseInt(req.params.mapId, 10);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    console.log(`[API] Fetching history for map ${mapId}${limit ? ` (limit: ${limit})` : ''}`);
    
    const history = await db.getMapHistory(mapId, limit);
    console.log(`[API] Found ${history.length} history entries for map ${mapId}`);
    
    res.json(history);
  } catch (error) {
    console.error('[API] Error fetching map history:', error);
    res.status(500).json({ error: 'Failed to fetch map history' });
  }
};