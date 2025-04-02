// Path: db\repos\feature-history.repo.ts

import { IDatabase } from 'pg-promise';
import { Feature } from '@/types/feature.types.js';
import { FeatureHistory } from '@/types/history.types.js';

export class FeatureHistoryRepository {
  private db: IDatabase<any>;

  constructor(db: IDatabase<any>) {
    this.db = db;
  }

  // Record feature creation
  async recordCreation(feature: Feature, userId: string, userName: string, clientOperationId?: string): Promise<FeatureHistory> {
    return this.db.one(
      `INSERT INTO feature_history 
       (feature_id, map_id, operation, previous_state, new_state, user_id, user_name, client_operation_id)
       VALUES ($1, $2, 'create', NULL, $3, $4, $5, $6)
       RETURNING *`,
      [feature.id, feature.map_id, feature, userId, userName, clientOperationId || null]
    );
  }

  // Record feature update
  async recordUpdate(
    previousState: Feature, 
    newState: Feature, 
    userId: string,
    userName: string,
    clientOperationId?: string
  ): Promise<FeatureHistory> {
    return this.db.one(
      `INSERT INTO feature_history 
       (feature_id, map_id, operation, previous_state, new_state, user_id, user_name, client_operation_id)
       VALUES ($1, $2, 'update', $3, $4, $5, $6, $7)
       RETURNING *`,
      [newState.id, newState.map_id, previousState, newState, userId, userName, clientOperationId || null]
    );
  }

  // Record feature deletion
  async recordDeletion(feature: Feature, userId: string, userName: string, clientOperationId?: string): Promise<FeatureHistory> {
    return this.db.one(
      `INSERT INTO feature_history 
       (feature_id, map_id, operation, previous_state, new_state, user_id, user_name, client_operation_id)
       VALUES ($1, $2, 'delete', $3, NULL, $4, $5, $6)
       RETURNING *`,
      [feature.id, feature.map_id, feature, userId, userName, clientOperationId || null]
    );
  }

  // Get feature history
  async getFeatureHistory(featureId: string): Promise<FeatureHistory[]> {
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

  // Get map history since timestamp with pagination
  async getMapHistorySince(
    mapId: number, 
    since: number,
    page: number = 1,
    limit: number = 100
  ): Promise<FeatureHistory[]> {
    const offset = (page - 1) * limit;
    
    return this.db.any(
      `SELECT * FROM feature_history
       WHERE map_id = $1 AND timestamp > to_timestamp($2/1000.0)
       ORDER BY timestamp ASC
       LIMIT $3 OFFSET $4`,
      [mapId, since, limit, offset]
    );
  }

  // Get deleted feature IDs since timestamp
  async getDeletedFeaturesSince(
    mapId: number, 
    since: number
  ): Promise<string[]> {
    const results = await this.db.any(
      `SELECT feature_id FROM feature_history
       WHERE map_id = $1 
       AND operation = 'delete' 
       AND timestamp > to_timestamp($2/1000.0)
       AND feature_id IS NOT NULL`,
      [mapId, since]
    );
    
    return results.map(r => r.feature_id);
  }

  // Check if an operation with this client operation ID already exists
  async getOperationByClientId(clientOperationId: string): Promise<FeatureHistory | null> {
    return this.db.oneOrNone(
      `SELECT * FROM feature_history
       WHERE client_operation_id = $1`,
      clientOperationId
    );
  }
}