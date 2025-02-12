import { Comment, MapBounds } from '../../types';

export interface UseCommentsOptions {
  roomId: string | null;
  onError?: (error: Error) => void;
}

import { Point } from '../../types';

export interface EntityChanges {
  content?: string;
  version?: number;
  location?: Point;
}

export interface PendingChange {
  type: 'update' | 'delete';
  entityId: string;
  entityType: 'comment' | 'reply';
  version: number;
  changes?: EntityChanges;
  timestamp: number;
}

export interface VersionTracking {
  pendingChanges: Map<string, PendingChange>;
  lastSuccessfulVersion: Map<string, number>;
}

export interface CommentsState {
  comments: Comment[];
  selectedComment: string | null;
  loading: boolean;
  error: Error | null;
  bounds: MapBounds | null;
}