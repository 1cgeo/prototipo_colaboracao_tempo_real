// db/repos/feature-history.repo.ts

import { IDatabase } from 'pg-promise';
import { Feature } from '@/types/feature.types.js';

export interface FeatureHistory {
  id: number;
  feature_id: number | null;
  map_id: number;
  operation: 'create' | 'update' | 'delete';
  previous_state: any | null;
  new_state: any | null;
  user_id: string;
  user_name: string;
  timestamp: Date;
}

export class FeatureHistoryRepository {
  private db: IDatabase<any>;

  constructor(db: IDatabase<any>) {
    this.db = db;
  }

  // Record feature creation
  async recordCreation(feature: Feature, userId: string, userName: string): Promise<FeatureHistory> {
    return this.db.one(
      `INSERT INTO feature_history 
       (feature_id, map_id, operation, previous_state, new_state, user_id, user_name)
       VALUES ($1, $2, 'create', NULL, $3, $4, $5)
       RETURNING *`,
      [feature.id, feature.map_id, feature, userId, userName]
    );
  }

  // Record feature update
  async recordUpdate(
    previousState: Feature, 
    newState: Feature, 
    userId: string,
    userName: string
  ): Promise<FeatureHistory> {
    return this.db.one(
      `INSERT INTO feature_history 
       (feature_id, map_id, operation, previous_state, new_state, user_id, user_name)
       VALUES ($1, $2, 'update', $3, $4, $5, $6)
       RETURNING *`,
      [newState.id, newState.map_id, previousState, newState, userId, userName]
    );
  }

  // Record feature deletion
  async recordDeletion(feature: Feature, userId: string, userName: string): Promise<FeatureHistory> {
    return this.db.one(
      `INSERT INTO feature_history 
       (feature_id, map_id, operation, previous_state, new_state, user_id, user_name)
       VALUES ($1, $2, 'delete', $3, NULL, $4, $5)
       RETURNING *`,
      [feature.id, feature.map_id, feature, userId, userName]
    );
  }

  // Get feature history (include map_id for future partitioning)
  async getFeatureHistory(featureId: number): Promise<FeatureHistory[]> {
    return this.db.any(
      `SELECT * FROM feature_history
       WHERE feature_id = $1
       ORDER BY timestamp DESC`,
      featureId
    );
  }

  // Get map history
  async getMapHistory(mapId: number, limit?: number): Promise<FeatureHistory[]> {
    const query = limit 
      ? `SELECT * FROM feature_history
         WHERE map_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`
      : `SELECT * FROM feature_history
         WHERE map_id = $1
         ORDER BY timestamp DESC`;
         
    const params = limit ? [mapId, limit] : [mapId];
    
    return this.db.any(query, params);
  }
}