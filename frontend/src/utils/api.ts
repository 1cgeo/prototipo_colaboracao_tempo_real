import { io, Socket } from 'socket.io-client';
import { throttle } from 'lodash';
import { 
  APIResponse,
  Room, RoomDetails, RoomCreateInput, RoomUpdateInput,
  Comment, CommentCreateInput, CommentUpdateInput,
  Reply, ReplyCreateInput, ReplyUpdateInput,
  Activity, Point, MapBounds,
  AuthConfig, AuthenticationSuccess, ErrorDetails,
  CommentCreateEvent, CommentUpdateEvent, CommentDeleteEvent,
  ReplyCreateEvent, ReplyUpdateEvent, ReplyDeleteEvent,
  CursorMoveEvent, API_ROUTES
} from '../types';

// Extensão do tipo Socket para incluir auth
interface ExtendedSocket extends Socket {
  auth: AuthConfig;
}

// WebSocket Configuration
const WS_CONFIG = {
  path: '/socket.io',
  pingTimeout: 10000,
  pingInterval: 3000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  autoConnect: false
};

const CURSOR_THROTTLE_DELAY = 100;
const CURSOR_DISTANCE_THRESHOLD = 0.0001;

let socket: ExtendedSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let lastCursorPosition: Point | null = null;

// Custom error class for API errors
export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: ErrorDetails = {}
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface RetryOptions {
  maxRetries?: number;
  backoffFactor?: number;
  initialDelay?: number;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxRetries: 3,
  backoffFactor: 2,
  initialDelay: 100
};

// Socket initialization with reconnection logic
export const initializeSocket = (config: AuthConfig): Promise<AuthenticationSuccess> => {
  return new Promise((resolve, reject) => {
    // Clear any existing socket
    if (socket) {
      socket.close();
      socket = null;
    }

    // Clear any existing reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    socket = io({
      ...WS_CONFIG,
      auth: config
    }) as ExtendedSocket;

    // Handle successful authentication
    socket.on('authentication:success', (data: AuthenticationSuccess) => {
      resolve(data);
    });

    // Handle authentication errors
    socket.on('authentication:error', (error: { code: string; message: string; details?: ErrorDetails }) => {
      reject(new APIError(error.code, error.message, error.details));
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason !== 'io client disconnect') {
        handleReconnection();
      }
    });

    // Connect the socket
    socket.connect();
  });
};

// Reconnection handler
const handleReconnection = () => {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    if (socket?.connected) return;

    console.log('Attempting to reconnect...');
    socket?.connect();
    
    reconnectTimer = null;
  }, WS_CONFIG.reconnectionDelay);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  lastCursorPosition = null;
};

// Operation retry handler with exponential backoff
const retryOperation = async <T>(
  operation: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  options: RetryOptions = {}
): Promise<T> => {
  const { maxRetries, backoffFactor, initialDelay } = {
    ...defaultRetryOptions,
    ...options
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (!shouldRetry(lastError) || attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = initialDelay * Math.pow(backoffFactor, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Version conflict handler
const handleVersionConflict = async <T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> => {
  return retryOperation(
    operation,
    (error) => error instanceof APIError && error.code === 'VERSION_CONFLICT',
    options
  );
};

// WebSocket Event Emitters
export const wsEvents = {
  joinRoom: (roomId: string) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('room:join', {
      roomId,
      timestamp: Date.now()
    });
  },

  leaveRoom: (roomId: string) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('room:leave', {
      roomId,
      timestamp: Date.now()
    });
  },

  moveCursor: throttle((roomId: string, location: Point) => {
    if (!socket) return;

    // Check if cursor has moved enough
    if (lastCursorPosition) {
      const [oldLng, oldLat] = lastCursorPosition.coordinates;
      const [newLng, newLat] = location.coordinates;
      const dx = newLng - oldLng;
      const dy = newLat - oldLat;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < CURSOR_DISTANCE_THRESHOLD) {
        return;
      }
    }

    lastCursorPosition = location;

    const event: CursorMoveEvent = {
      roomId,
      user_id: socket.auth.user_id,
      location,
      timestamp: Date.now()
    };

    socket.emit('cursor:move', event);
  }, CURSOR_THROTTLE_DELAY, { leading: true, trailing: true }),

  createComment: (roomId: string, content: string, location: Point) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: CommentCreateEvent = {
      roomId,
      user_id: socket.auth.user_id,
      content,
      location,
      timestamp: Date.now()
    };
    
    socket.emit('comment:create', event);
  },

  updateComment: (roomId: string, commentId: string, content: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: CommentUpdateEvent = {
      roomId,
      user_id: socket.auth.user_id,
      comment_id: commentId,
      content,
      version,
      timestamp: Date.now()
    };
    
    socket.emit('comment:update', event);
  },

  deleteComment: (roomId: string, commentId: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: CommentDeleteEvent = {
      roomId,
      user_id: socket.auth.user_id,
      comment_id: commentId,
      version,
      timestamp: Date.now()
    };
    
    socket.emit('comment:delete', event);
  },

  createReply: (roomId: string, commentId: string, content: string) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: ReplyCreateEvent = {
      roomId,
      user_id: socket.auth.user_id,
      comment_id: commentId,
      content,
      timestamp: Date.now()
    };
    
    socket.emit('reply:create', event);
  },

  updateReply: (roomId: string, commentId: string, replyId: string, content: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: ReplyUpdateEvent = {
      roomId,
      user_id: socket.auth.user_id,
      comment_id: commentId,
      reply_id: replyId,
      content,
      version,
      timestamp: Date.now()
    };
    
    socket.emit('reply:update', event);
  },

  deleteReply: (roomId: string, commentId: string, replyId: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: ReplyDeleteEvent = {
      roomId,
      user_id: socket.auth.user_id,
      comment_id: commentId,
      reply_id: replyId,
      version,
      timestamp: Date.now()
    };
    
    socket.emit('reply:delete', event);
  }
};

// API Response Handler with proper typing
async function handleResponse<T>(response: Response): Promise<T> {
  const data: APIResponse<T> = await response.json();
  
  if (data.status === 'error') {
    throw new APIError(
      data.code,
      data.message,
      data.details
    );
  }
  
  return data.data;
}

// Room API
export const roomApi = {
  list: async (): Promise<Room[]> => {
    const response = await fetch(API_ROUTES.listRooms);
    return handleResponse<Room[]>(response);
  },

  create: async (input: RoomCreateInput): Promise<Room> => {
    const response = await fetch(API_ROUTES.createRoom, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Room>(response);
  },

  get: async (uuid: string): Promise<RoomDetails> => {
    const response = await fetch(API_ROUTES.getRoom(uuid));
    return handleResponse<RoomDetails>(response);
  },

  update: async (uuid: string, input: RoomUpdateInput): Promise<Room> => {
    const response = await fetch(API_ROUTES.updateRoom(uuid), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Room>(response);
  },

  delete: async (uuid: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteRoom(uuid), {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// Comments API with version conflict handling
export const commentApi = {
  list: async (roomId: string, bounds?: MapBounds): Promise<Comment[]> => {
    const response = await fetch(API_ROUTES.listComments(roomId, bounds));
    return handleResponse<Comment[]>(response);
  },

  create: async (roomId: string, input: CommentCreateInput): Promise<Comment> => {
    const response = await fetch(API_ROUTES.createComment(roomId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Comment>(response);
  },

  update: async (roomId: string, commentId: string, input: CommentUpdateInput): Promise<Comment> => {
    return handleVersionConflict(async () => {
      const response = await fetch(API_ROUTES.updateComment(roomId, commentId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return handleResponse<Comment>(response);
    });
  },

  delete: async (roomId: string, commentId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteComment(roomId, commentId), {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// Replies API with version conflict handling
export const replyApi = {
  create: async (roomId: string, commentId: string, input: ReplyCreateInput): Promise<Reply> => {
    const response = await fetch(API_ROUTES.createReply(roomId, commentId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Reply>(response);
  },

  update: async (roomId: string, commentId: string, replyId: string, input: ReplyUpdateInput): Promise<Reply> => {
    return handleVersionConflict(async () => {
      const response = await fetch(API_ROUTES.updateReply(roomId, commentId, replyId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return handleResponse<Reply>(response);
    });
  },

  delete: async (roomId: string, commentId: string, replyId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteReply(roomId, commentId, replyId), {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// Activity API with pagination
export const activityApi = {
  getLog: async (roomId: string, params: { before?: string; limit?: number } = {}): Promise<Activity[]> => {
    const url = new URL(API_ROUTES.getActivityLog(roomId), window.location.origin);
    if (params.before) url.searchParams.append('before', params.before);
    if (params.limit) url.searchParams.append('limit', params.limit.toString());
    
    const response = await fetch(url.toString());
    return handleResponse<Activity[]>(response);
  },

  getUserActivity: async (roomId: string, userId: string): Promise<Activity[]> => {
    const response = await fetch(API_ROUTES.getUserActivity(roomId, userId));
    return handleResponse<Activity[]>(response);
  },
};

// Export the socket instance getter
export const getSocket = (): ExtendedSocket | null => socket;