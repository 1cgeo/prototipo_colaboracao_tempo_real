// Path: db\repos\features.repo.ts

import { IDatabase } from 'pg-promise';
import { Feature, CreateFeatureDTO, UpdateFeatureDTO } from '@/types/feature.types.js';

// Default precision to use in SQL queries for geometry coordinates
// 5 decimal places ≈ 1.1 meter precision at the equator
const DEFAULT_GEOMETRY_PRECISION = 5;

export class FeaturesRepository {
  private db: IDatabase<any>;

  constructor(db: IDatabase<any>) {
    this.db = db;
  }

  // Get all features for a map
  async getMapFeatures(mapId: number): Promise<Feature[]> {
    return this.db.any(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry, ${DEFAULT_GEOMETRY_PRECISION})::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version,
       client_id, offline_created
       FROM features 
       WHERE map_id = $1
       ORDER BY created_at ASC`,
      mapId
    );
  }

  // Get features by type
  async getMapFeaturesByType(mapId: number, featureType: string): Promise<Feature[]> {
    return this.db.any(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry, ${DEFAULT_GEOMETRY_PRECISION})::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version,
       client_id, offline_created
       FROM features 
       WHERE map_id = $1 AND feature_type = $2
       ORDER BY created_at ASC`,
      [mapId, featureType]
    );
  }

  // Get specific feature - Always include map_id in the query for partition readiness
  async getFeature(id: string): Promise<Feature | null> {
    return this.db.oneOrNone(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry, ${DEFAULT_GEOMETRY_PRECISION})::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version,
       client_id, offline_created
       FROM features 
       WHERE id = $1`,
      id
    );
  }

  // Get feature by client_id (for offline reconciliation)
  async getFeatureByClientId(clientId: string, mapId: number): Promise<Feature | null> {
    return this.db.oneOrNone(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry, ${DEFAULT_GEOMETRY_PRECISION})::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version,
       client_id, offline_created
       FROM features 
       WHERE client_id = $1 AND map_id = $2`,
      [clientId, mapId]
    );
  }

  // Create feature
  async createFeature(data: CreateFeatureDTO): Promise<Feature> {
    // Always include map_id to make it partition-ready
    return this.db.one(
      `INSERT INTO features 
       (map_id, feature_type, geometry, properties, user_id, user_name, client_id, offline_created)
       VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5, $6, $7, $8)
       RETURNING id, map_id, feature_type, 
       ST_AsGeoJSON(geometry, ${DEFAULT_GEOMETRY_PRECISION})::json as geometry,
       properties, user_id, user_name, created_at, updated_at, version,
       client_id, offline_created`,
      [
        data.map_id,
        data.feature_type,
        JSON.stringify(data.geometry),
        data.properties,
        data.user_id,
        data.user_name,
        data.client_id || null,
        data.offline_created || false
      ]
    );
  }

  // Update feature with version check for optimistic concurrency
  async updateFeature(
    id: string, 
    data: UpdateFeatureDTO, 
    userId: string,
    userName: string
  ): Promise<{ success: boolean; feature?: Feature; currentVersion?: number }> {
    // Start a transaction for atomic operations
    return this.db.tx('update-feature', async (t) => {
      // First get current feature and check version
      const currentFeature = await t.oneOrNone(
        `SELECT id, map_id, version, feature_type, ST_AsGeoJSON(geometry, ${DEFAULT_GEOMETRY_PRECISION})::json as geometry,
         properties, user_id, user_name, created_at, updated_at, client_id, offline_created
         FROM features
         WHERE id = $1
         FOR UPDATE`,
        id
      );

      if (!currentFeature) {
        return { success: false }; // Feature not found
      }

      // Check if versions match for optimistic concurrency
      if (currentFeature.version !== data.version) {
        return { 
          success: false,
          currentVersion: currentFeature.version
        }; // Version mismatch
      }

      // Build the update query
      const updates = [];
      const values = [];
      let paramCounter = 1;

      // If updating geometry
      if (data.geometry) {
        updates.push(`geometry = ST_GeomFromGeoJSON($${paramCounter})`);
        values.push(JSON.stringify(data.geometry));
        paramCounter++;
      }

      // If updating properties
      if (data.properties) {
        updates.push(`properties = $${paramCounter}`);
        values.push(data.properties);
        paramCounter++;
      }

      // Always update version, user, and timestamp
      updates.push(`version = version + 1`);
      updates.push(`user_id = $${paramCounter}`);
      values.push(userId);
      paramCounter++;
      
      updates.push(`user_name = $${paramCounter}`);
      values.push(userName);
      paramCounter++;
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      // Only proceed if there are updates
      if (updates.length === 0) {
        return { success: true, feature: currentFeature };
      }

      // Add feature ID to values
      values.push(id);

      // Execute the update
      const updatedFeature = await t.one(
        `UPDATE features
         SET ${updates.join(', ')}
         WHERE id = $${paramCounter}
         RETURNING id, map_id, feature_type, 
         ST_AsGeoJSON(geometry, ${DEFAULT_GEOMETRY_PRECISION})::json as geometry,
         properties, user_id, user_name, created_at, updated_at, version,
         client_id, offline_created`,
        values
      );

      // Return success with updated feature
      return { success: true, feature: updatedFeature };
    });
  }

  // Delete feature
  async deleteFeature(id: string): Promise<boolean> {
    const result = await this.db.result(
      'DELETE FROM features WHERE id = $1',
      id
    );
    return result.rowCount > 0;
  }

  // Bulk delete features
  async bulkDeleteFeatures(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    
    const result = await this.db.result(
      'DELETE FROM features WHERE id IN ($1:csv)',
      [ids]
    );
    return result.rowCount;
  }

  // Get features within a bounding box
  // Always include map_id in the query for partition readiness
  async getFeaturesInBounds(
    mapId: number,
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): Promise<Feature[]> {
    return this.db.any(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry, ${DEFAULT_GEOMETRY_PRECISION})::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version,
       client_id, offline_created
       FROM features 
       WHERE map_id = $1 AND 
       ST_Intersects(
         geometry, 
         ST_MakeEnvelope($2, $3, $4, $5, 4326)
       )
       ORDER BY created_at ASC`,
      [mapId, minLng, minLat, maxLng, maxLat]
    );
  }

  // Get features updated since a timestamp with adaptive precision
  async getUpdatedFeatures(
    mapId: number,
    since: number,
    page: number = 1,
    limit: number = 100,
    precision: number = DEFAULT_GEOMETRY_PRECISION
  ): Promise<Feature[]> {
    const offset = (page - 1) * limit;
    
    return this.db.any(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry, $5)::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version,
       client_id, offline_created
       FROM features 
       WHERE map_id = $1 AND updated_at > to_timestamp($2/1000.0)
       ORDER BY updated_at ASC
       LIMIT $3 OFFSET $4`,
      [mapId, since, limit, offset, precision]
    );
  }

  // Get features in viewport updated since timestamp with pagination and adaptive precision
  async getFeaturesInViewportSince(
    mapId: number,
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    since: number,
    page: number = 1,
    limit: number = 100,
    precision: number = DEFAULT_GEOMETRY_PRECISION
  ): Promise<Feature[]> {
    const offset = (page - 1) * limit;
    
    return this.db.any(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry, $9)::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version,
       client_id, offline_created
       FROM features 
       WHERE map_id = $1 
       AND updated_at > to_timestamp($2/1000.0)
       AND ST_Intersects(
         geometry, 
         ST_MakeEnvelope($3, $4, $5, $6, 4326)
       )
       ORDER BY updated_at ASC
       LIMIT $7 OFFSET $8`,
      [mapId, since, minLng, minLat, maxLng, maxLat, limit, offset, precision]
    );
  }

  // Count updated features for pagination
  async getUpdatedFeaturesCount(
    mapId: number,
    since: number
  ): Promise<number> {
    const result = await this.db.one(
      `SELECT COUNT(*) as count
       FROM features 
       WHERE map_id = $1 AND updated_at > to_timestamp($2/1000.0)`,
      [mapId, since]
    );
    return parseInt(result.count);
  }

  // Check if a feature was deleted
  async isFeatureDeleted(featureId: string): Promise<boolean> {
    const result = await this.db.oneOrNone(
      `SELECT 1 FROM feature_history
       WHERE feature_id = $1 AND operation = 'delete'
       LIMIT 1`,
      featureId
    );
    return result !== null;
  }
}