import { Point } from './index.js';

export interface WebSocketEvent {
  timestamp: number;
  room_id: string;
  user_id: string;
}

export interface RoomJoinEvent extends WebSocketEvent {
  display_name: string;
}

export interface RoomLeaveEvent extends WebSocketEvent {
  room_id: string;
}

export interface RoomStateEvent extends WebSocketEvent {
  users: Array<{
    id: string;
    display_name: string;
    joined_at: string;
  }>;
  comments: Array<{
    id: string;
    content: string;
    location: Point;
    author_id: string;
    author_name: string;
    version: number;
    created_at: string;
    updated_at: string;
    replies: Array<{
      id: string;
      content: string;
      author_id: string;
      author_name: string;
      version: number;
      created_at: string;
      updated_at: string;
    }>;
  }>;
  cursors: Array<{
    user_id: string;
    location: Point;
    timestamp: number;
  }>;
}

export interface CursorMoveEvent extends WebSocketEvent {
  location: Point;
}

export interface CursorUpdateEvent extends WebSocketEvent {
  user_id: string;
  location: Point;
  timestamp: number;
}

export interface CommentCreateEvent extends WebSocketEvent {
  content: string;
  location: Point;
}

export interface CommentUpdateEvent extends WebSocketEvent {
  comment_id: string;
  content: string;
  version: number;
}

export interface CommentDeleteEvent extends WebSocketEvent {
  comment_id: string;
  version: number;
}

export interface ReplyCreateEvent extends WebSocketEvent {
  comment_id: string;
  content: string;
}

export interface ReplyUpdateEvent extends WebSocketEvent {
  reply_id: string;
  content: string;
  version: number;
}

export interface ReplyDeleteEvent extends WebSocketEvent {
  reply_id: string;
  version: number;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: unknown;
}

export interface ConnectionEvent extends WebSocketEvent {
  connection_id: string;
  reconnecting: boolean;
}

export interface AuthEvent {
  user_id: string;
  display_name: string;
}

export interface ServerToClientEvents {
  'user:info': (auth: AuthEvent) => void;
  'room:state': (event: RoomStateEvent) => void;
  'room:user_joined': (event: RoomJoinEvent) => void;
  'room:user_left': (event: RoomLeaveEvent) => void;
  'cursor:update': (event: CursorUpdateEvent) => void;
  'comment:created': (comment: CommentCreateEvent & { id: string }) => void;
  'comment:updated': (
    comment: CommentUpdateEvent & { updated_at: string },
  ) => void;
  'comment:deleted': (event: { comment_id: string }) => void;
  'reply:created': (
    event: ReplyCreateEvent & { id: string; created_at: string },
  ) => void;
  'reply:updated': (event: ReplyUpdateEvent & { updated_at: string }) => void;
  'reply:deleted': (event: { reply_id: string }) => void;
  error: (event: ErrorEvent) => void;
  reconnect: (event: ConnectionEvent) => void;
  disconnect: (reason: string) => void;
}

export interface ClientToServerEvents {
  'room:join': (event: RoomJoinEvent) => void;
  'room:leave': (event: RoomLeaveEvent) => void;
  'cursor:move': (event: CursorMoveEvent) => void;
  'comment:create': (event: CommentCreateEvent) => void;
  'comment:update': (event: CommentUpdateEvent) => void;
  'comment:delete': (event: CommentDeleteEvent) => void;
  'reply:create': (event: ReplyCreateEvent) => void;
  'reply:update': (event: ReplyUpdateEvent) => void;
  'reply:delete': (event: ReplyDeleteEvent) => void;
}

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';
