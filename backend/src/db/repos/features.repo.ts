// db/repos/features.repo.ts

import { IDatabase } from 'pg-promise';
import { Feature, CreateFeatureDTO, UpdateFeatureDTO } from '@/types/feature.types.js';

export class FeaturesRepository {
  private db: IDatabase<any>;

  constructor(db: IDatabase<any>) {
    this.db = db;
  }

  // Get all features for a map
  async getMapFeatures(mapId: number): Promise<Feature[]> {
    return this.db.any(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry)::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version
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
       ST_AsGeoJSON(geometry)::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version
       FROM features 
       WHERE map_id = $1 AND feature_type = $2
       ORDER BY created_at ASC`,
      [mapId, featureType]
    );
  }

  // Get specific feature - Always include map_id in the query for partition readiness
  async getFeature(id: number): Promise<Feature | null> {
    return this.db.oneOrNone(
      `SELECT id, map_id, feature_type, 
       ST_AsGeoJSON(geometry)::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version
       FROM features 
       WHERE id = $1`,
      id
    );
  }

  // Create feature
  async createFeature(data: CreateFeatureDTO): Promise<Feature> {
    // Always include map_id to make it partition-ready
    return this.db.one(
      `INSERT INTO features 
       (map_id, feature_type, geometry, properties, user_id, user_name)
       VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5, $6)
       RETURNING id, map_id, feature_type, 
       ST_AsGeoJSON(geometry)::json as geometry,
       properties, user_id, user_name, created_at, updated_at, version`,
      [
        data.map_id,
        data.feature_type,
        JSON.stringify(data.geometry),
        data.properties,
        data.user_id,
        data.user_name
      ]
    );
  }

  // Update feature with version check for optimistic concurrency
  async updateFeature(
    id: number, 
    data: UpdateFeatureDTO, 
    userId: string,
    userName: string
  ): Promise<{ success: boolean; feature?: Feature; currentVersion?: number }> {
    // Start a transaction for atomic operations
    return this.db.tx('update-feature', async (t) => {
      // First get current feature and check version
      const currentFeature = await t.oneOrNone(
        `SELECT id, map_id, version, feature_type, ST_AsGeoJSON(geometry)::json as geometry,
         properties, user_id, user_name, created_at, updated_at 
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
         ST_AsGeoJSON(geometry)::json as geometry,
         properties, user_id, user_name, created_at, updated_at, version`,
        values
      );

      // Return success with updated feature
      return { success: true, feature: updatedFeature };
    });
  }

  // Delete feature
  async deleteFeature(id: number): Promise<boolean> {
    const result = await this.db.result(
      'DELETE FROM features WHERE id = $1',
      id
    );
    return result.rowCount > 0;
  }

  // Bulk delete features
  async bulkDeleteFeatures(ids: number[]): Promise<number> {
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
       ST_AsGeoJSON(geometry)::json as geometry, 
       properties, user_id, user_name, created_at, updated_at, version
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
}