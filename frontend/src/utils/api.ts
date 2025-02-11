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
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

interface AuthSuccessData {
  userId: string;
  displayName: string;
}

let socket: Socket | null = null;

// Validate display name format from backend
function isValidDisplayName(name: string): boolean {
  return /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name);
}

export const initializeSocket = (userId: string): Promise<AuthSuccessData> => {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const userData = JSON.parse(stored);
        return resolve(userData);
      }
    }

    socket = io({
      ...WS_CONFIG,
      auth: { userId }
    });

    // Handle successful authentication
    socket.on('authentication:success', (data: AuthSuccessData) => {
      if (!isValidDisplayName(data.displayName)) {
        console.error('Invalid display name received:', data.displayName);
        reject(new Error('Invalid display name format'));
        return;
      }

      // Store user data in localStorage
      localStorage.setItem('currentUser', JSON.stringify(data));
      resolve(data);
    });

    // Handle authentication errors
    socket.on('authentication:error', (error: Error) => {
      reject(error);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      // Clear stored user data on disconnect
      localStorage.removeItem('currentUser');
    });

    // Handle reconnection
    socket.on('reconnect', () => {
      // Will trigger authentication:success again
      console.log('Socket reconnected, awaiting new authentication');
    });
  });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    localStorage.removeItem('currentUser');
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

// Activity API with pagination
export const activityApi = {
  getLog: async (roomId: string, params: { before?: string, limit?: number } = {}): Promise<Activity[]> => {
    const url = new URL(API_ROUTES.getActivityLog(roomId), window.location.origin);
    if (params.before) url.searchParams.append('before', params.before);
    if (params.limit) url.searchParams.append('limit', params.limit.toString());
    const response = await fetch(url.toString());
    return handleResponse(response);
  },

  getUserActivity: async (roomId: string, userId: string): Promise<Activity[]> => {
    const response = await fetch(API_ROUTES.getUserActivity(roomId, userId));
    return handleResponse(response);
  },
};