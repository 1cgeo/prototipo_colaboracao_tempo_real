import { Point } from './index.js';

export interface WebSocketEvent {
  timestamp: number;
  roomId: string;
  userId: string;
}

export interface RoomJoinEvent extends WebSocketEvent {
  displayName: string;
}

export interface RoomLeaveEvent extends WebSocketEvent {
  roomId: string;
}

export interface RoomStateEvent extends WebSocketEvent {
  users: Array<{
    id: string;
    displayName: string;
    joinedAt: string;
  }>;
  comments: Array<{
    id: string;
    content: string;
    location: Point;
    authorId: string;
    authorName: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    replies: Array<{
      id: string;
      content: string;
      authorId: string;
      authorName: string;
      version: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  cursors: Array<{
    userId: string;
    location: Point;
    timestamp: number;
  }>;
}

export interface CursorMoveEvent extends WebSocketEvent {
  location: Point;
}

export interface CursorUpdateEvent extends WebSocketEvent {
  userId: string;
  location: Point;
  timestamp: number;
}

export interface CommentCreateEvent extends WebSocketEvent {
  content: string;
  location: Point;
}

export interface CommentUpdateEvent extends WebSocketEvent {
  commentId: string;
  content: string;
  version: number;
}

export interface CommentDeleteEvent extends WebSocketEvent {
  commentId: string;
  version: number;
}

export interface ReplyCreateEvent extends WebSocketEvent {
  commentId: string;
  content: string;
}

export interface ReplyUpdateEvent extends WebSocketEvent {
  replyId: string;
  content: string;
  version: number;
}

export interface ReplyDeleteEvent extends WebSocketEvent {
  replyId: string;
  version: number;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: unknown;
}

export interface ConnectionEvent extends WebSocketEvent {
  connectionId: string;
  reconnecting: boolean;
}

export interface ServerToClientEvents {
  'room:state': (event: RoomStateEvent) => void;
  'room:userJoined': (event: RoomJoinEvent) => void;
  'room:userLeft': (event: RoomLeaveEvent) => void;
  'cursor:update': (event: CursorUpdateEvent) => void;
  'comment:created': (comment: CommentCreateEvent & { id: string }) => void;
  'comment:updated': (
    comment: CommentUpdateEvent & { updatedAt: string },
  ) => void;
  'comment:deleted': (event: { commentId: string }) => void;
  'reply:created': (
    event: ReplyCreateEvent & { id: string; createdAt: string },
  ) => void;
  'reply:updated': (event: ReplyUpdateEvent & { updatedAt: string }) => void;
  'reply:deleted': (event: { replyId: string }) => void;
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
