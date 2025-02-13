// Base API Response types
export interface APISuccessResponse<T> {
  status: 'success';
  data: T;
}

// Error types
export interface ErrorDetails {
  current_version?: number;
  provided_version?: number;
  server_data?: unknown;
  field?: string;
  value?: unknown;
  constraint?: string;
}

export interface APIErrorResponse {
  status: 'error';
  code: string;
  message: string;
  details?: ErrorDetails;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: ErrorDetails;
}

export type APIResponse<T> = APISuccessResponse<T> | APIErrorResponse;

// Authentication types
export interface AuthConfig {
  user_id: string;
}

export interface UserInfo {
  user_id: string;
  display_name: string;
  room_id?: string | null;
}

// Basic geometry types
export interface Point {
  type: 'Point';
  coordinates: [number, number];
}

export interface MapBounds {
  ne: { lat: number; lng: number };
  sw: { lat: number; lng: number };
}

// User types
export interface User {
  id: string;
  display_name: string;
  joined_at: string;
}

// Room types
export interface Room {
  uuid: string;
  name: string;
  description: string;
  active_users_count: number;
  current_users: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoomDetails extends Room {
  users: User[];
  activity: Activity[];
}

export interface RoomCreateInput {
  name: string;
  description: string;
}

export interface RoomUpdateInput {
  name?: string;
  description?: string;
}

// WebSocket Events
// Room events
export interface RoomStateEvent {
  users: User[];
  comments: Comment[];
  cursors: CursorPosition[];
  timestamp: number;
  room_id: string;
  user_id: string;
}

export interface RoomJoinEvent {
  room_id: string;
  user_id: string;
  display_name: string;
  timestamp: number;
}

export interface RoomLeaveEvent {
  room_id: string;
  user_id: string;
  display_name: string | null;
  timestamp: number;
}

// Cursor types
export interface CursorPosition {
  user_id: string;
  location: Point;
  timestamp: number;
}

export interface CursorMoveEvent {
  user_id: string;
  room_id: string;
  location: Point;
  timestamp: number;
}

// Comment types
export interface Comment {
  id: string;
  content: string;
  location: Point;
  author_id: string;
  author_name: string;
  version: number;
  created_at: string;
  updated_at: string;
  replies: Reply[];
}

export interface CommentCreateInput {
  content: string;
  location: Point;
}

export interface CommentUpdateInput {
  content: string;
  version: number;
}

export interface CommentEvent {
  user_id: string;
  room_id: string;
  comment_id: string;
  content: string;
  version: number;
  timestamp: number;
}

export interface CommentCreateEvent extends Omit<CommentEvent, 'comment_id' | 'version'> {
  location: Point;
}

export interface CommentUpdateEvent extends CommentEvent {}

export interface CommentDeleteEvent extends Omit<CommentEvent, 'content'> {}

// Reply types
export interface Reply {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ReplyCreateInput {
  content: string;
}

export interface ReplyUpdateInput {
  content: string;
  version: number;
}

export interface ReplyEvent {
  user_id: string;
  room_id: string;
  comment_id: string;
  reply_id: string;
  content: string;
  version: number;
  timestamp: number;
}

export interface ReplyCreateEvent extends Omit<ReplyEvent, 'reply_id' | 'version'> {}

export interface ReplyUpdateEvent extends ReplyEvent {}

export interface ReplyDeleteEvent extends Omit<ReplyEvent, 'content'> {}

// Activity types
export type ActivityType = 
  | 'COMMENT_CREATED'
  | 'COMMENT_UPDATED'
  | 'COMMENT_DELETED'
  | 'REPLY_CREATED'
  | 'REPLY_UPDATED'
  | 'REPLY_DELETED'
  | 'USER_JOINED'
  | 'USER_LEFT';

export interface ActivityMetadata {
  comment_id?: string;
  reply_id?: string;
  content?: string;
  location?: Point;
  version?: number;
  room_id?: string;
  user_id?: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  user_id: string;
  user_name: string;
  metadata: ActivityMetadata;
  created_at: string;
}

// WebSocket event names
export const WS_EVENTS = {
  // User events
  USER_INFO: 'user:info',
  
  // Room events
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_STATE: 'room:state',
  ROOM_USER_JOINED: 'room:user_joined',
  ROOM_USER_LEFT: 'room:user_left',
  
  // Cursor events
  CURSOR_MOVE: 'cursor:move',
  CURSOR_UPDATE: 'cursor:update',
  
  // Comment events
  COMMENT_CREATE: 'comment:create',
  COMMENT_UPDATE: 'comment:update',
  COMMENT_DELETE: 'comment:delete',
  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_DELETED: 'comment:deleted',
  
  // Reply events
  REPLY_CREATE: 'reply:create',
  REPLY_UPDATE: 'reply:update',
  REPLY_DELETE: 'reply:delete',
  REPLY_CREATED: 'reply:created',
  REPLY_UPDATED: 'reply:updated',
  REPLY_DELETED: 'reply:deleted',
  
  // System events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error'
};