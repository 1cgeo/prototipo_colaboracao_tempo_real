import { io, Socket } from 'socket.io-client';
import { throttle } from 'lodash';
import { 
  APIResponse,
  Room, RoomDetails, RoomCreateInput, RoomUpdateInput,
  Comment, CommentCreateInput, CommentUpdateInput,
  Point, MapBounds,
  AuthConfig, UserInfo, ErrorEvent,
  CursorMoveEvent, WS_EVENTS
} from '../types';

// Extensão do tipo Socket para incluir auth
interface ExtendedSocket extends Socket {
  auth: AuthConfig;
}

// Get base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
let userInfo: UserInfo | null = null;

// Socket initialization with reconnection logic
export const initializeSocket = (config: AuthConfig): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (socket) {
      socket.close();
      socket = null;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    socket = io(API_BASE_URL, {
      ...WS_CONFIG,
      auth: config
    }) as ExtendedSocket;

    // Store original auth for client use
    socket.auth = config;

    // Listen for connection success
    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    // Listen for userInfo event
    socket.on(WS_EVENTS.USER_INFO, (data: UserInfo) => {
      userInfo = data;
      resolve();
    });

    socket.on('error', (error: ErrorEvent) => {
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
  userInfo = null;
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

// Room API
export const roomApi = {
  list: async (): Promise<Room[]> => {
    return apiCall<Room[]>('/api/maps');
  },

  create: async (input: RoomCreateInput): Promise<Room> => {
    return apiCall<Room>('/api/maps', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  get: async (uuid: string): Promise<RoomDetails> => {
    return apiCall<RoomDetails>(`/api/maps/${uuid}`);
  },

  update: async (uuid: string, input: RoomUpdateInput): Promise<Room> => {
    return apiCall<Room>(`/api/maps/${uuid}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  delete: async (uuid: string): Promise<void> => {
    return apiCall<void>(`/api/maps/${uuid}`, {
      method: 'DELETE',
    });
  },
};

// Comment API
export const commentApi = {
  list: async (roomId: string, bounds?: MapBounds): Promise<Comment[]> => {
    const url = new URL(`/api/maps/${roomId}/comments`, window.location.origin);
    if (bounds) {
      url.searchParams.append('bounds', JSON.stringify(bounds));
    }
    return apiCall<Comment[]>(url.toString());
  },

  create: async (roomId: string, input: CommentCreateInput): Promise<Comment> => {
    return apiCall<Comment>(`/api/maps/${roomId}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update: async (roomId: string, commentId: string, input: CommentUpdateInput): Promise<Comment> => {
    return apiCall<Comment>(`/api/maps/${roomId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  delete: async (roomId: string, commentId: string): Promise<void> => {
    return apiCall<void>(`/api/maps/${roomId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  },
};

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

// Get socket instance
export const getSocket = (): ExtendedSocket | null => socket;

// WebSocket event emitters
export const wsEvents = {
  joinRoom: (roomId: string) => {
    if (!socket || !userInfo) throw new Error('Socket not initialized');
    socket.emit(WS_EVENTS.ROOM_JOIN, {
      room_id: roomId,
      user_id: userInfo.user_id,
      display_name: userInfo.display_name,
      timestamp: Date.now()
    });
  },

  leaveRoom: (roomId: string) => {
    if (!socket || !userInfo) throw new Error('Socket not initialized');
    socket.emit(WS_EVENTS.ROOM_LEAVE, {
      room_id: roomId,
      user_id: userInfo.user_id,
      timestamp: Date.now()
    });
  },

  moveCursor: throttle((roomId: string, location: Point) => {
    if (!socket || !userInfo) return;

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
      user_id: userInfo.user_id,
      room_id: roomId,
      location,
      timestamp: Date.now()
    };

    socket.emit(WS_EVENTS.CURSOR_MOVE, event);
  }, CURSOR_THROTTLE_DELAY, { leading: true, trailing: true }),

  createComment: (roomId: string, content: string, location: Point) => {
    if (!socket || !userInfo) throw new Error('Socket not initialized');
    socket.emit(WS_EVENTS.COMMENT_CREATE, {
      room_id: roomId,
      user_id: userInfo.user_id,
      content,
      location,
      timestamp: Date.now()
    });
  },

  updateComment: (roomId: string, commentId: string, content: string, version: number) => {
    if (!socket || !userInfo) throw new Error('Socket not initialized');
    socket.emit(WS_EVENTS.COMMENT_UPDATE, {
      room_id: roomId,
      comment_id: commentId,
      user_id: userInfo.user_id,
      content,
      version,
      timestamp: Date.now()
    });
  },

  deleteComment: (roomId: string, commentId: string, version: number) => {
    if (!socket || !userInfo) throw new Error('Socket not initialized');
    socket.emit(WS_EVENTS.COMMENT_DELETE, {
      room_id: roomId,
      comment_id: commentId,
      user_id: userInfo.user_id,
      version,
      timestamp: Date.now()
    });
  },

  createReply: (roomId: string, commentId: string, content: string) => {
    if (!socket || !userInfo) throw new Error('Socket not initialized');
    socket.emit(WS_EVENTS.REPLY_CREATE, {
      room_id: roomId,
      comment_id: commentId,
      user_id: userInfo.user_id,
      content,
      timestamp: Date.now()
    });
  },

  updateReply: (roomId: string, commentId: string, replyId: string, content: string, version: number) => {
    if (!socket || !userInfo) throw new Error('Socket not initialized');
    socket.emit(WS_EVENTS.REPLY_UPDATE, {
      room_id: roomId,
      comment_id: commentId,
      reply_id: replyId,
      user_id: userInfo.user_id,
      content,
      version,
      timestamp: Date.now()
    });
  },

  deleteReply: (roomId: string, commentId: string, replyId: string, version: number) => {
    if (!socket || !userInfo) throw new Error('Socket not initialized');
    socket.emit(WS_EVENTS.REPLY_DELETE, {
      room_id: roomId,
      comment_id: commentId,
      reply_id: replyId,
      user_id: userInfo.user_id,
      version,
      timestamp: Date.now()
    });
  }
};