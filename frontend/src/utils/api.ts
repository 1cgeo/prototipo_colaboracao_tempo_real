import { io, Socket } from 'socket.io-client';
import { throttle } from 'lodash';
import { 
  APIResponse,
  Room, RoomDetails, RoomCreateInput, RoomUpdateInput,
  Comment, CommentCreateInput, CommentUpdateInput,
  Point, MapBounds,
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

const CURSOR_THROTTLE_DELAY = 100; // 100ms
const CURSOR_DISTANCE_THRESHOLD = 0.0001; // Approximately 11 meters at equator

let socket: ExtendedSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let lastCursorPosition: Point | null = null;

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
      reject(new Error(error.message));
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

// WebSocket Event Emitters
export const wsEvents = {
  joinRoom: (roomId: string) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('room:join', {
      room_id: roomId,
      timestamp: Date.now()
    });
  },

  leaveRoom: (roomId: string) => {
    if (!socket) throw new Error('Socket not initialized');
    socket.emit('room:leave', {
      room_id: roomId,
      timestamp: Date.now()
    });
  },

  moveCursor: throttle((_roomId: string, location: Point) => {
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
      user_id: socket.auth.user_id,
      location,
      timestamp: Date.now()
    };

    socket.emit('cursor:move', event);
  }, CURSOR_THROTTLE_DELAY, { leading: true, trailing: true }),

  createComment: (_roomId: string, content: string, location: Point) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: CommentCreateEvent = {
      user_id: socket.auth.user_id,
      content,
      location,
      timestamp: Date.now()
    };
    
    socket.emit('comment:create', event);
  },

  updateComment: (_roomId: string, commentId: string, content: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: CommentUpdateEvent = {
      user_id: socket.auth.user_id,
      comment_id: commentId,
      content,
      version,
      timestamp: Date.now()
    };
    
    socket.emit('comment:update', event);
  },

  deleteComment: (_roomId: string, commentId: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: CommentDeleteEvent = {
      user_id: socket.auth.user_id,
      comment_id: commentId,
      version,
      timestamp: Date.now()
    };
    
    socket.emit('comment:delete', event);
  },

  createReply: (_roomId: string, commentId: string, content: string) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: ReplyCreateEvent = {
      user_id: socket.auth.user_id,
      comment_id: commentId,
      content,
      timestamp: Date.now()
    };
    
    socket.emit('reply:create', event);
  },

  updateReply: (_roomId: string, commentId: string, replyId: string, content: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: ReplyUpdateEvent = {
      user_id: socket.auth.user_id,
      comment_id: commentId,
      reply_id: replyId,
      content,
      version,
      timestamp: Date.now()
    };
    
    socket.emit('reply:update', event);
  },

  deleteReply: (_roomId: string, commentId: string, replyId: string, version: number) => {
    if (!socket) throw new Error('Socket not initialized');
    
    const event: ReplyDeleteEvent = {
      user_id: socket.auth.user_id,
      comment_id: commentId,
      reply_id: replyId,
      version,
      timestamp: Date.now()
    };
    
    socket.emit('reply:delete', event);
  }
};

// API Response Handler
async function handleResponse<T>(response: Response): Promise<T> {
  const data: APIResponse<T> = await response.json();
  
  if (data.status === 'error') {
    throw new Error(data.message);
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

// Comments API
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
    const response = await fetch(API_ROUTES.updateComment(roomId, commentId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Comment>(response);
  },

  delete: async (roomId: string, commentId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteComment(roomId, commentId), {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// Socket instance getter
export const getSocket = (): ExtendedSocket | null => socket;