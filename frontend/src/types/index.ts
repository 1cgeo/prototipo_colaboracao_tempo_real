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

// Room events
export interface RoomStateEvent {
  users: User[];
  comments: Comment[];
  cursors: CursorPosition[];
  timestamp: number;
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
  display_name: string;
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
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'COMMENT_CREATE'
  | 'COMMENT_UPDATE'
  | 'COMMENT_DELETE'
  | 'REPLY_CREATE'
  | 'REPLY_UPDATE'
  | 'REPLY_DELETE';

export interface ActivityMetadata {
  comment_id?: string;
  reply_id?: string;
  content?: string;
  location?: Point;
  version?: number;
  user_id?: string;
  room_id?: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  user_id: string;
  user_name: string;
  metadata: ActivityMetadata;
  created_at: string;
}

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