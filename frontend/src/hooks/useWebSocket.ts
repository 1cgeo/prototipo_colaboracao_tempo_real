import { useEffect, useState, useCallback } from 'react';
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
  Point
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
}

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
    currentRoom: null
  });

  // Initialize socket connection
  const connectSocket = useCallback(async () => {
    if (state.authenticating) return;

    setState(prev => ({ ...prev, authenticating: true }));

    try {
      const authData = await initializeSocket({ 
        user_id: userId, 
        display_name: displayName 
      });
      
      setState(prev => ({ 
        ...prev, 
        connected: true,
        authenticating: false
      }));

      onAuthSuccess?.(authData);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        connected: false,
        authenticating: false
      }));

      if (error instanceof Error) {
        onAuthError?.({
          code: 'AUTH_ERROR',
          message: error.message
        });
      }
      
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [userId, displayName, state.authenticating, onAuthSuccess, onAuthError, onError]);

  // Setup socket connection
  useEffect(() => {
    connectSocket();

    return () => {
      disconnectSocket();
    };
  }, [connectSocket]);

  // Setup socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Base handlers that are always available
    const handleConnect = () => {
      setState(prev => ({ ...prev, connected: true }));

      // Rejoin room if we were in one
      if (state.currentRoom) {
        wsEvents.joinRoom(state.currentRoom);
      }
    };

    const handleDisconnect = () => {
      setState(prev => ({ ...prev, connected: false }));
    };

    const handleError = (error: Error) => {
      onError?.(error);
    };

    // Handler factory to ensure we always return a function
    const createHandler = <T extends unknown>(callback?: (data: T) => void) => 
      (data: T) => callback?.(data);

    // Connection events
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', () => onReconnect?.());
    socket.on('error', handleError);

    // Room events with type-safe handlers
    socket.on('room:state', createHandler<RoomStateEvent>(onRoomState));
    socket.on('room:join', createHandler<RoomJoinEvent>(onJoin));
    socket.on('room:leave', createHandler<RoomLeaveEvent>(onLeave));
    socket.on('cursor:move', createHandler<CursorMoveEvent>(onCursorMove));

    // Comment events with type-safe handlers
    socket.on('comment:create', createHandler<CommentCreateEvent>(onCommentCreate));
    socket.on('comment:update', createHandler<CommentUpdateEvent>(onCommentUpdate));
    socket.on('comment:delete', createHandler<CommentDeleteEvent>(onCommentDelete));

    // Reply events with type-safe handlers
    socket.on('reply:create', createHandler<ReplyCreateEvent>(onReplyCreate));
    socket.on('reply:update', createHandler<ReplyUpdateEvent>(onReplyUpdate));
    socket.on('reply:delete', createHandler<ReplyDeleteEvent>(onReplyDelete));

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect');
      socket.off('error', handleError);
      socket.off('room:state');
      socket.off('room:join');
      socket.off('room:leave');
      socket.off('cursor:move');
      socket.off('comment:create');
      socket.off('comment:update');
      socket.off('comment:delete');
      socket.off('reply:create');
      socket.off('reply:update');
      socket.off('reply:delete');
    };
  }, [
    state.currentRoom,
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