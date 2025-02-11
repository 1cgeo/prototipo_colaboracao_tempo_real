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

export type APIResponse<T> = APISuccessResponse<T> | APIErrorResponse;

// Authentication types
export interface AuthConfig {
  user_id: string;
  display_name: string;
}

export interface AuthenticationSuccess {
  user_id: string;
  display_name: string;
}

export interface AuthenticationError {
  code: string;
  message: string;
  details?: ErrorDetails;
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

// Event base type
export interface BaseEvent {
  timestamp: number;
  room_id: string;
  user_id: string;
}

// Room events
export interface RoomJoinEvent extends BaseEvent {
  display_name: string;
}

export interface RoomLeaveEvent extends BaseEvent {
  display_name: string;
}

export interface RoomStateEvent extends BaseEvent {
  users: User[];
  comments: Comment[];
  cursors: CursorPosition[];
}

// Cursor types
export interface CursorPosition {
  user_id: string;
  location: Point;
  timestamp: number;
}

export interface CursorMoveEvent extends BaseEvent {
  location: Point;
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

export interface CommentCreateEvent extends BaseEvent {
  content: string;
  location: Point;
}

export interface CommentUpdateEvent extends BaseEvent {
  comment_id: string;
  content: string;
  version: number;
}

export interface CommentDeleteEvent extends BaseEvent {
  comment_id: string;
  version: number;
}

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

export interface ReplyCreateEvent extends BaseEvent {
  comment_id: string;
  content: string;
}

export interface ReplyUpdateEvent extends BaseEvent {
  comment_id: string;
  reply_id: string;
  content: string;
  version: number;
}

export interface ReplyDeleteEvent extends BaseEvent {
  comment_id: string;
  reply_id: string;
  version: number;
}

// Activity types
export interface Activity {
  id: string;
  type: ActivityType;
  user_id: string;
  user_name: string;
  metadata: ActivityMetadata;
  created_at: string;
}

export interface ActivityMetadata {
  comment_id?: string;
  reply_id?: string;
  content?: string;
  location?: Point;
  version?: number;
}

export type ActivityType = 
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'COMMENT_CREATE'
  | 'COMMENT_UPDATE'
  | 'COMMENT_DELETE'
  | 'REPLY_CREATE'
  | 'REPLY_UPDATE'
  | 'REPLY_DELETE';

// Helper types for frontend
export interface UIComment extends Omit<Comment, 'created_at' | 'updated_at' | 'author_id' | 'author_name'> {
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
}

export interface UIReply extends Omit<Reply, 'created_at' | 'updated_at' | 'author_id' | 'author_name'> {
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
}

export interface UIActivity extends Omit<Activity, 'created_at' | 'user_id' | 'user_name'> {
  createdAt: string;
  userId: string;
  userName: string;
}

// Helper functions for converting between snake_case and camelCase
export const toCamelCase = <T extends object>(obj: T): { [K in keyof T as Capitalize<string & K>]: T[K] } => {
  const newObj = {} as { [key: string]: any };
  Object.keys(obj).forEach(key => {
    const newKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
    newObj[newKey] = obj[key as keyof T];
  });
  return newObj as { [K in keyof T as Capitalize<string & K>]: T[K] };
};

export const toSnakeCase = <T extends object>(obj: T): { [K in keyof T as Uncapitalize<string & K>]: T[K] } => {
  const newObj = {} as { [key: string]: any };
  Object.keys(obj).forEach(key => {
    const newKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[newKey] = obj[key as keyof T];
  });
  return newObj as { [K in keyof T as Uncapitalize<string & K>]: T[K] };
};

// API Routes
export const API_ROUTES = {
  // Room Management
  listRooms: '/api/maps',
  createRoom: '/api/maps',
  getRoom: (uuid: string) => `/api/maps/${uuid}`,
  updateRoom: (uuid: string) => `/api/maps/${uuid}`,
  deleteRoom: (uuid: string) => `/api/maps/${uuid}`,

  // Comments and Replies
  listComments: (roomId: string, bounds?: MapBounds) => {
    const url = `/api/maps/${roomId}/comments`;
    if (bounds) {
      return `${url}?bounds=${encodeURIComponent(JSON.stringify(bounds))}`;
    }
    return url;
  },
  createComment: (roomId: string) => `/api/maps/${roomId}/comments`,
  updateComment: (roomId: string, commentId: string) => 
    `/api/maps/${roomId}/comments/${commentId}`,
  deleteComment: (roomId: string, commentId: string) => 
    `/api/maps/${roomId}/comments/${commentId}`,
  createReply: (roomId: string, commentId: string) => 
    `/api/maps/${roomId}/comments/${commentId}/replies`,
  updateReply: (roomId: string, commentId: string, replyId: string) => 
    `/api/maps/${roomId}/comments/${commentId}/replies/${replyId}`,
  deleteReply: (roomId: string, commentId: string, replyId: string) => 
    `/api/maps/${roomId}/comments/${commentId}/replies/${replyId}`,

  // Activity Logs
  getActivityLog: (roomId: string) => `/api/maps/${roomId}/activity`,
  getUserActivity: (roomId: string, userId: string) => 
    `/api/maps/${roomId}/activity/${userId}`,
};