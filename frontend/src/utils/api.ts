import { io, Socket } from 'socket.io-client';
import { 
  Room, RoomCreateInput, RoomUpdateInput,
  Comment, CommentCreateInput, CommentUpdateInput,
  Reply, ReplyCreateInput, ReplyUpdateInput,
  Activity, APIError, API_ROUTES
} from '../types';

// WebSocket Configuration
const WS_CONFIG = {
  path: '/socket.io',
  pingTimeout: 10000,
  pingInterval: 3000,
};

let socket: Socket | null = null;

export const initializeSocket = (userId: string, displayName: string) => {
  if (socket) return socket;

  socket = io({
    ...WS_CONFIG,
    auth: {
      userId,
      displayName,
    },
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// API Error Handler
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error: APIError = await response.json();
    throw error;
  }
  return response.json();
};

// Room API
export const roomApi = {
  list: async (): Promise<Room[]> => {
    const response = await fetch(API_ROUTES.listRooms);
    return handleResponse(response);
  },

  create: async (input: RoomCreateInput): Promise<Room> => {
    const response = await fetch(API_ROUTES.createRoom, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  get: async (uuid: string): Promise<Room> => {
    const response = await fetch(API_ROUTES.getRoom(uuid));
    return handleResponse(response);
  },

  update: async (uuid: string, input: RoomUpdateInput): Promise<Room> => {
    const response = await fetch(API_ROUTES.updateRoom(uuid), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  delete: async (uuid: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteRoom(uuid), {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

// Comments API
export const commentApi = {
  list: async (roomId: string): Promise<Comment[]> => {
    const response = await fetch(API_ROUTES.listComments(roomId));
    return handleResponse(response);
  },

  create: async (roomId: string, input: CommentCreateInput): Promise<Comment> => {
    const response = await fetch(API_ROUTES.createComment(roomId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  update: async (roomId: string, commentId: string, input: CommentUpdateInput): Promise<Comment> => {
    const response = await fetch(API_ROUTES.updateComment(roomId, commentId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  delete: async (roomId: string, commentId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteComment(roomId, commentId), {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

// Replies API
export const replyApi = {
  create: async (roomId: string, commentId: string, input: ReplyCreateInput): Promise<Reply> => {
    const response = await fetch(API_ROUTES.createReply(roomId, commentId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  update: async (
    roomId: string, 
    commentId: string, 
    replyId: string, 
    input: ReplyUpdateInput
  ): Promise<Reply> => {
    const response = await fetch(API_ROUTES.updateReply(roomId, commentId, replyId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  delete: async (roomId: string, commentId: string, replyId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteReply(roomId, commentId, replyId), {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

// Activity API
export const activityApi = {
  getLog: async (roomId: string, before?: string): Promise<Activity[]> => {
    const url = new URL(API_ROUTES.getActivityLog(roomId), window.location.origin);
    if (before) url.searchParams.append('before', before);
    const response = await fetch(url.toString());
    return handleResponse(response);
  },

  getUserActivity: async (roomId: string, userId: string): Promise<Activity[]> => {
    const response = await fetch(API_ROUTES.getUserActivity(roomId, userId));
    return handleResponse(response);
  },
};