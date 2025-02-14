import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { wsEvents } from '../utils/websocketEvents';
import { 
  initializeSocket, 
  getSocket, 
  clearSocket
} from '../config/socket';
import { WS_EVENTS } from '../types';
import { 
  UserInfo,
  RoomStateEvent,
  RoomJoinEvent,
  RoomLeaveEvent,
  CursorMoveEvent,
  CommentCreateEvent,
  CommentUpdateEvent,
  CommentDeleteEvent,
  ReplyCreateEvent,
  ReplyUpdateEvent,
  ReplyDeleteEvent,
  Point,
  ErrorEvent
} from '../types';

interface UseWebSocketOptions {
  user_id: string;
  onUserInfo?: (data: UserInfo) => void;
  onRoomState?: (state: RoomStateEvent) => void;
  onJoin?: (event: RoomJoinEvent) => void;
  onLeave?: (event: RoomLeaveEvent) => void;
  onCursorMove?: (event: CursorMoveEvent) => void;
  onCommentCreate?: (event: CommentCreateEvent) => void;
  onCommentUpdate?: (event: CommentUpdateEvent) => void;
  onCommentDelete?: (event: CommentDeleteEvent) => void;
  onReplyCreate?: (event: ReplyCreateEvent) => void;
  onReplyUpdate?: (event: ReplyUpdateEvent) => void;
  onReplyDelete?: (event: ReplyDeleteEvent) => void;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}

interface WebSocketState {
  connected: boolean;
  authenticating: boolean;
  currentRoom: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

export const useWebSocket = ({
  user_id,
  onUserInfo,
  onRoomState,
  onJoin,
  onLeave,
  onCursorMove,
  onCommentCreate,
  onCommentUpdate,
  onCommentDelete,
  onReplyCreate,
  onReplyUpdate,
  onReplyDelete,
  onError,
  onReconnect
}: UseWebSocketOptions) => {
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    authenticating: false,
    currentRoom: null
  });

  const initializingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  const connectSocket = useCallback(async () => {
    console.log('[WebSocket] Attempting to connect socket');
    
    // Prevent multiple simultaneous initialization attempts
    if (initializingRef.current || state.authenticating) {
      console.log('[WebSocket] Connection already in progress, skipping');
      return;
    }
    
    initializingRef.current = true;
    setState(prev => ({ ...prev, authenticating: true }));

    try {
      await initializeSocket(API_BASE_URL, { 
        user_id, 
        display_name: `User-${user_id.slice(0, 6)}` 
      });

      console.log('[WebSocket] Socket initialized successfully');
      
      setState(prev => ({ 
        ...prev, 
        connected: true,
        authenticating: false
      }));

      reconnectAttemptsRef.current = 0;
      
    } catch (error) {
      console.error('[WebSocket] Socket initialization failed:', error);
      
      setState(prev => ({ 
        ...prev, 
        connected: false,
        authenticating: false
      }));
      
      onError?.(error instanceof Error ? error : new Error('Failed to initialize socket'));

      // Schedule reconnect if within attempts limit
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        console.log('[WebSocket] Scheduling reconnect attempt');
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connectSocket();
        }, RECONNECT_DELAY);
      } else {
        console.error('[WebSocket] Max reconnection attempts reached');
        onError?.(new Error('Failed to connect after maximum attempts'));
      }
    } finally {
      initializingRef.current = false;
    }
  }, [user_id, state.authenticating, onError]);

  // Setup socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.log('[WebSocket] No socket found, initiating connection');
      connectSocket();
      return;
    }

    // Base handlers that are always available
    const handleConnect = () => {
      console.log('[WebSocket] Socket connected');
      setState(prev => ({ ...prev, connected: true }));

      // Rejoin room if we were in one
      if (state.currentRoom) {
        console.log('[WebSocket] Rejoining room:', state.currentRoom);
        socket.emit(WS_EVENTS.ROOM_JOIN, {
          room_id: state.currentRoom,
          user_id,
          timestamp: Date.now()
        });
      }
    };

    const handleDisconnect = (reason: string) => {
      console.log('[WebSocket] Socket disconnected:', reason);
      setState(prev => ({ ...prev, connected: false }));
      
      // Attempt reconnect if not an intentional disconnect
      if (reason !== 'io client disconnect') {
        connectSocket();
      }
    };

    const handleError = (error: ErrorEvent) => {
      console.error('[WebSocket] Socket error:', error);
      onError?.(new Error(error.message));
    };

    // Handler factory to ensure we always return a function
    const createHandler = <T extends unknown>(
      eventName: string,
      callback?: (data: T) => void
    ) => (data: T) => {
      console.log(`[WebSocket] Received ${eventName} event:`, data);
      callback?.(data);
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', () => {
      console.log('[WebSocket] Socket reconnected');
      onReconnect?.();
    });
    socket.on('error', handleError);
    
    // Application events
    socket.on(WS_EVENTS.USER_INFO, createHandler<UserInfo>('user:info', onUserInfo));
    socket.on(WS_EVENTS.ROOM_STATE, createHandler<RoomStateEvent>('room:state', onRoomState));
    socket.on(WS_EVENTS.ROOM_USER_JOINED, createHandler<RoomJoinEvent>('room:user_joined', onJoin));
    socket.on(WS_EVENTS.ROOM_USER_LEFT, createHandler<RoomLeaveEvent>('room:user_left', onLeave));
    socket.on(WS_EVENTS.CURSOR_UPDATE, createHandler<CursorMoveEvent>('cursor:update', onCursorMove));
    socket.on(WS_EVENTS.COMMENT_CREATED, createHandler<CommentCreateEvent>('comment:created', onCommentCreate));
    socket.on(WS_EVENTS.COMMENT_UPDATED, createHandler<CommentUpdateEvent>('comment:updated', onCommentUpdate));
    socket.on(WS_EVENTS.COMMENT_DELETED, createHandler<CommentDeleteEvent>('comment:deleted', onCommentDelete));
    socket.on(WS_EVENTS.REPLY_CREATED, createHandler<ReplyCreateEvent>('reply:created', onReplyCreate));
    socket.on(WS_EVENTS.REPLY_UPDATED, createHandler<ReplyUpdateEvent>('reply:updated', onReplyUpdate));
    socket.on(WS_EVENTS.REPLY_DELETED, createHandler<ReplyDeleteEvent>('reply:deleted', onReplyDelete));

    return () => {
      console.log('[WebSocket] Cleaning up socket event listeners');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect');
      socket.off('error', handleError);
      socket.off(WS_EVENTS.USER_INFO);
      socket.off(WS_EVENTS.ROOM_STATE);
      socket.off(WS_EVENTS.ROOM_USER_JOINED);
      socket.off(WS_EVENTS.ROOM_USER_LEFT);
      socket.off(WS_EVENTS.CURSOR_UPDATE);
      socket.off(WS_EVENTS.COMMENT_CREATED);
      socket.off(WS_EVENTS.COMMENT_UPDATED);
      socket.off(WS_EVENTS.COMMENT_DELETED);
      socket.off(WS_EVENTS.REPLY_CREATED);
      socket.off(WS_EVENTS.REPLY_UPDATED);
      socket.off(WS_EVENTS.REPLY_DELETED);
    };
  }, [
    user_id,
    state.currentRoom,
    connectSocket,
    onUserInfo,
    onRoomState,
    onJoin,
    onLeave,
    onCursorMove,
    onCommentCreate,
    onCommentUpdate,
    onCommentDelete,
    onReplyCreate,
    onReplyUpdate,
    onReplyDelete,
    onError,
    onReconnect
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[WebSocket] Component unmounting, cleaning up');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearSocket();
    };
  }, []);

  // Get user info from socket state
  const userInfo = useMemo(() => {
    const socket = getSocket();
    return socket?.auth || null;
  }, []);

  // Room management functions
  const joinRoom = useCallback((roomId: string) => {
    console.log('[WebSocket] Attempting to join room:', roomId);
    if (!state.connected || !userInfo) {
      throw new Error('Socket not connected or user not authorized');
    }

    setState(prev => ({ ...prev, currentRoom: roomId }));
    wsEvents.joinRoom(roomId, userInfo.user_id, userInfo.display_name);
  }, [state.connected, userInfo]);

  const leaveRoom = useCallback((roomId: string) => {
    console.log('[WebSocket] Leaving room:', roomId);
    if (!state.connected || !userInfo) return;

    setState(prev => ({ ...prev, currentRoom: null }));
    wsEvents.leaveRoom(roomId, userInfo.user_id);
  }, [state.connected, userInfo]);

  // Cursor update function
  const updateCursor = useCallback((position: Point) => {
    if (!state.connected || !state.currentRoom || !userInfo) return;
    
    wsEvents.moveCursor(state.currentRoom, userInfo.user_id, position);
  }, [state.connected, state.currentRoom, userInfo]);

  return {
    socket: getSocket(),
    connected: state.connected,
    authenticating: state.authenticating,
    currentRoom: state.currentRoom,
    joinRoom,
    leaveRoom,
    updateCursor,
    userInfo
  };
};