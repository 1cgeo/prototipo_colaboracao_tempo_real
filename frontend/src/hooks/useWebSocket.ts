import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { initializeSocket, disconnectSocket, getSocket, wsEvents } from '../utils/api';
import { 
  AuthenticationSuccess, 
  AuthenticationError,
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
  APIError
} from '../types';

interface UseWebSocketOptions {
  userId: string;
  displayName: string;
  onAuthSuccess?: (data: AuthenticationSuccess) => void;
  onAuthError?: (error: AuthenticationError) => void;
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
  reconnectAttempts: number;
}

const MAX_RECONNECT_ATTEMPTS = 5;

const isAuthenticationError = (error: unknown): error is AuthenticationError => {
  return error instanceof Error && 'code' in error;
};

const useWebSocket = ({
  userId,
  displayName,
  onAuthSuccess,
  onAuthError,
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
    currentRoom: null,
    reconnectAttempts: 0
  });

  // Initialize socket connection
  useEffect(() => {
    let mounted = true;
    setState(prev => ({ ...prev, authenticating: true }));

    const connectSocket = async () => {
      try {
        const authData = await initializeSocket({ 
          user_id: userId, 
          display_name: displayName 
        });
        
        if (!mounted) return;

        setState(prev => ({ 
          ...prev, 
          connected: true,
          authenticating: false,
          reconnectAttempts: 0
        }));
        onAuthSuccess?.(authData);
      } catch (error) {
        if (!mounted) return;
        
        setState(prev => ({ 
          ...prev, 
          connected: false,
          authenticating: false
        }));

        if (error instanceof APIError) {
          onAuthError?.({
            code: error.code,
            message: error.message,
            details: error.details
          });
        }
        
        onError?.(error instanceof Error ? error : new Error('Unknown error'));
      }
    };

    connectSocket();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [userId, displayName, onAuthSuccess, onAuthError, onError]);

  // Setup socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Connection events
    const handleConnect = () => {
      setState(prev => ({ 
        ...prev, 
        connected: true,
        reconnectAttempts: 0
      }));

      // Rejoin room if we were in one
      if (state.currentRoom) {
        wsEvents.joinRoom(state.currentRoom);
      }
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      setState(prev => ({ 
        ...prev, 
        connected: false
      }));
      
      if (reason === 'io server disconnect') {
        return; // Server initiated disconnect, don't reconnect
      }

      if (state.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setState(prev => ({
          ...prev,
          reconnectAttempts: prev.reconnectAttempts + 1
        }));
      }
    };

    const handleReconnect = () => {
      onReconnect?.();
    };

    const handleError = (error: Error) => {
      onError?.(error);
    };

    // Room events
    const handleRoomState = (event: RoomStateEvent) => {
      onRoomState?.(event);
    };

    const handleUserJoin = (event: RoomJoinEvent) => {
      onJoin?.(event);
    };

    const handleUserLeave = (event: RoomLeaveEvent) => {
      onLeave?.(event);
    };

    const handleCursorMove = (event: CursorMoveEvent) => {
      onCursorMove?.(event);
    };

    // Comment events
    const handleCommentCreate = (event: CommentCreateEvent) => {
      onCommentCreate?.(event);
    };

    const handleCommentUpdate = (event: CommentUpdateEvent) => {
      onCommentUpdate?.(event);
    };

    const handleCommentDelete = (event: CommentDeleteEvent) => {
      onCommentDelete?.(event);
    };

    // Reply events
    const handleReplyCreate = (event: ReplyCreateEvent) => {
      onReplyCreate?.(event);
    };

    const handleReplyUpdate = (event: ReplyUpdateEvent) => {
      onReplyUpdate?.(event);
    };

    const handleReplyDelete = (event: ReplyDeleteEvent) => {
      onReplyDelete?.(event);
    };

    // Register all event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    socket.on('error', handleError);
    socket.on('room:state', handleRoomState);
    socket.on('room:join', handleUserJoin);
    socket.on('room:leave', handleUserLeave);
    socket.on('cursor:move', handleCursorMove);
    socket.on('comment:create', handleCommentCreate);
    socket.on('comment:update', handleCommentUpdate);
    socket.on('comment:delete', handleCommentDelete);
    socket.on('reply:create', handleReplyCreate);
    socket.on('reply:update', handleReplyUpdate);
    socket.on('reply:delete', handleReplyDelete);

    return () => {
      // Cleanup all event listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
      socket.off('error', handleError);
      socket.off('room:state', handleRoomState);
      socket.off('room:join', handleUserJoin);
      socket.off('room:leave', handleUserLeave);
      socket.off('cursor:move', handleCursorMove);
      socket.off('comment:create', handleCommentCreate);
      socket.off('comment:update', handleCommentUpdate);
      socket.off('comment:delete', handleCommentDelete);
      socket.off('reply:create', handleReplyCreate);
      socket.off('reply:update', handleReplyUpdate);
      socket.off('reply:delete', handleReplyDelete);
    };
  }, [
    state.currentRoom,
    state.reconnectAttempts,
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

  // Room management functions
  const joinRoom = useCallback((roomId: string) => {
    if (!state.connected) {
      throw new Error('Socket not connected');
    }

    setState(prev => ({ ...prev, currentRoom: roomId }));
    wsEvents.joinRoom(roomId);
  }, [state.connected]);

  const leaveRoom = useCallback((roomId: string) => {
    if (!state.connected) return;

    setState(prev => ({ ...prev, currentRoom: null }));
    wsEvents.leaveRoom(roomId);
  }, [state.connected]);

  // Cursor update function
  const updateCursor = useCallback((roomId: string, location: Point) => {
    if (!state.connected) return;
    wsEvents.moveCursor(roomId, location);
  }, [state.connected]);

  return {
    socket: getSocket(),
    connected: state.connected,
    authenticating: state.authenticating,
    joinRoom,
    leaveRoom,
    updateCursor,
  };
};

export default useWebSocket;