// Path: types\history.types.ts

import { Feature } from './feature.types.js';

// Only export the FeatureHistory type which is referenced externally
type OperationType = 'create' | 'update' | 'delete';

export interface FeatureHistory {
  id: number;
  feature_id: string | null; // UUID, null for deleted features
  map_id: number;
  operation: OperationType;
  previous_state: Feature | null; // null for create operations
  new_state: Feature | null; // null for delete operations
  user_id: string;
  user_name: string;
  timestamp: Date;
  client_operation_id?: string;
}