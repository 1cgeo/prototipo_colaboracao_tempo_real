import { io, Socket } from 'socket.io-client';
import { throttle } from 'lodash';
import { 
  APIResponse,
  Room, RoomDetails, RoomCreateInput, RoomUpdateInput,
  Comment, CommentCreateInput, CommentUpdateInput,
  Point, MapBounds,
  AuthConfig, AuthenticationSuccess, ErrorDetails,
  CursorMoveEvent, API_ROUTES
} from '../types';

// Extensão do tipo Socket para incluir auth
interface ExtendedSocket extends Socket {
  auth: AuthConfig;
}

// Get base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// WebSocket Configuration
const WS_CONFIG = {
  path: '/socket',
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
let displayName: string | null = null;

// Socket initialization with reconnection logic
export const initializeSocket = (config: AuthConfig): Promise<AuthenticationSuccess> => {
  return new Promise((resolve, reject) => {
    if (socket) {
      socket.close();
      socket = null;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // Convert user_id to userId for server compatibility
    const serverAuth = {
      userId: config.user_id
    };

    socket = io(API_BASE_URL, {
      ...WS_CONFIG,
      auth: serverAuth
    }) as ExtendedSocket;

    // Store original auth for client use
    socket.auth = config;

    // Listen for connection success
    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    // Listen for userInfo event that provides the display name
    socket.on('userInfo', (data: { userId: string; displayName: string }) => {
      displayName = data.displayName;
      resolve({
        user_id: data.userId,
        display_name: data.displayName
      });
    });

    socket.on('error', (error: { code: string; message: string; details?: ErrorDetails }) => {
      console.error('Socket error:', error);
      reject(new Error(error.message));
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connect error:', error);
      handleReconnection();
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason !== 'io client disconnect') {
        handleReconnection();
      }
    });

    socket.connect();
  });
};

// Disconnect socket
export const disconnectSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  lastCursorPosition = null;
  displayName = null;
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

// API Response Handler
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API Error');
  }
  
  const data = await response.json() as APIResponse<T>;
  if (data.status === 'error') {
    throw new Error(data.message);
  }
  
  return data.data;
}

// Generic API call function
async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const url = new URL(path, API_BASE_URL);
  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return handleResponse<T>(response);
}

// Room API
export const roomApi = {
  list: async (): Promise<Room[]> => {
    return apiCall<Room[]>(API_ROUTES.listRooms);
  },

  create: async (input: RoomCreateInput): Promise<Room> => {
    return apiCall<Room>(API_ROUTES.createRoom, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  get: async (uuid: string): Promise<RoomDetails> => {
    return apiCall<RoomDetails>(API_ROUTES.getRoom(uuid));
  },

  update: async (uuid: string, input: RoomUpdateInput): Promise<Room> => {
    return apiCall<Room>(API_ROUTES.updateRoom(uuid), {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  delete: async (uuid: string): Promise<void> => {
    return apiCall<void>(API_ROUTES.deleteRoom(uuid), {
      method: 'DELETE',
    });
  },
};

// Comment API
export const commentApi = {
  list: async (roomId: string, bounds?: MapBounds): Promise<Comment[]> => {
    return apiCall<Comment[]>(API_ROUTES.listComments(roomId, bounds));
  },

  create: async (roomId: string, input: CommentCreateInput): Promise<Comment> => {
    return apiCall<Comment>(API_ROUTES.createComment(roomId), {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update: async (roomId: string, commentId: string, input: CommentUpdateInput): Promise<Comment> => {
    return apiCall<Comment>(API_ROUTES.updateComment(roomId, commentId), {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  delete: async (roomId: string, commentId: string): Promise<void> => {
    return apiCall<void>(API_ROUTES.deleteComment(roomId, commentId), {
      method: 'DELETE',
    });
  },
};

// Get socket instance
export const getSocket = (): ExtendedSocket | null => socket;

// Get current display name
export const getDisplayName = (): string | null => displayName;

// WebSocket event emitters
export const wsEvents = {
  joinRoom: (roomId: string) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('room:join', {
      roomId,
      userId: socket.auth.user_id,
      timestamp: Date.now()
    });
  },

  leaveRoom: (roomId: string) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('room:leave', {
      roomId,
      userId: socket.auth.user_id,
      timestamp: Date.now()
    });
  },

  moveCursor: throttle((roomId: string, location: Point) => {
    if (!socket) return;

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
      user_id: socket.auth.user_id,
      room_id: roomId,
      location,
      timestamp: Date.now()
    };

    socket.emit('cursor:move', event);
  }, CURSOR_THROTTLE_DELAY, { leading: true, trailing: true }),

  createComment: (roomId: string, content: string, location: Point) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('comment:create', {
      roomId,
      userId: socket.auth.user_id,
      content,
      location,
      timestamp: Date.now()
    });
  },

  updateComment: (roomId: string, commentId: string, content: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('comment:update', {
      roomId,
      commentId,
      userId: socket.auth.user_id,
      content,
      version,
      timestamp: Date.now()
    });
  },

  deleteComment: (roomId: string, commentId: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('comment:delete', {
      roomId,
      commentId,
      userId: socket.auth.user_id,
      version,
      timestamp: Date.now()
    });
  },

  createReply: (roomId: string, commentId: string, content: string) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('reply:create', {
      roomId,
      commentId,
      userId: socket.auth.user_id,
      content,
      timestamp: Date.now()
    });
  },

  updateReply: (roomId: string, commentId: string, replyId: string, content: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('reply:update', {
      roomId,
      commentId,
      replyId,
      userId: socket.auth.user_id,
      content,
      version,
      timestamp: Date.now()
    });
  },

  deleteReply: (roomId: string, commentId: string, replyId: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('reply:delete', {
      roomId,
      commentId,
      replyId,
      userId: socket.auth.user_id,
      version,
      timestamp: Date.now()
    });
  }
};

// Export configured event names for external use
export const WS_EVENTS = {
  // Room events
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_STATE: 'room:state',
  ROOM_USER_JOINED: 'room:userJoined',
  ROOM_USER_LEFT: 'room:userLeft',
  
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
  ERROR: 'error',
  USER_INFO: 'userInfo'
};