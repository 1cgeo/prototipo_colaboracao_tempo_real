// types/history.types.ts

import { Feature } from './feature.types.js';

export type OperationType = 'create' | 'update' | 'delete';

export interface FeatureHistory {
  id: number;
  feature_id: number | null; // null for deleted features
  map_id: number;
  operation: OperationType;
  previous_state: Feature | null; // null for create operations
  new_state: Feature | null; // null for delete operations
  user_id: string;
  user_name: string;
  timestamp: Date;
}

// DTOs for history operations
export interface CreateHistoryDTO {
  feature_id: number;
  map_id: number;
  operation: OperationType;
  previous_state: Feature | null;
  new_state: Feature | null;
  user_id: string;
  user_name: string;
}

export interface GetHistoryOptions {
  mapId?: number;
  featureId?: number;
  userId?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}