// Basic Types
export interface Point {
  type: 'Point';
  coordinates: [number, number];
}

export interface User {
  id: string;
  displayName: string;
  joinedAt: string;
}

// Room Types
export interface Room {
  uuid: string;
  name: string;
  description: string;
  activeUsers: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomCreateInput {
  name: string;
  description: string;
}

export interface RoomUpdateInput {
  name?: string;
  description?: string;
}

// Authentication Types
export interface AuthenticationSuccess {
  userId: string;
  displayName: string;
}

export interface AuthenticationError {
  message: string;
  code: string;
}

// WebSocket Event Types
export interface WebSocketEvent {
  timestamp: number;
  roomId: string;
  userId: string;
}

export interface RoomJoinEvent extends WebSocketEvent {
  displayName: string;
}

export interface RoomLeaveEvent extends WebSocketEvent {
  timestamp: number;
  roomId: string;
  userId: string;
}

export interface CursorMoveEvent extends WebSocketEvent {
  location: Point;
}

// Comment Types
export interface Comment {
  id: string;
  content: string;
  location: Point;
  authorId: string;
  authorName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
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

// Reply Types
export interface Reply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReplyCreateInput {
  content: string;
}

export interface ReplyUpdateInput {
  content: string;
  version: number;
}

// Activity Types
export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  metadata: {
    commentId?: string;
    replyId?: string;
    content?: string;
    location?: Point;
    version?: number;
  };
  timestamp: string;
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

// API Error Types
export interface APIError {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
}

// API Routes
export const API_ROUTES = {
  // Map Room Management
  listRooms: '/api/maps',
  createRoom: '/api/maps',
  getRoom: (uuid: string) => `/api/maps/${uuid}`,
  updateRoom: (uuid: string) => `/api/maps/${uuid}`,
  deleteRoom: (uuid: string) => `/api/maps/${uuid}`,

  // Comments and Replies
  listComments: (roomId: string) => `/api/maps/${roomId}/comments`,
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