import { useEffect, useState, useCallback } from 'react';
import { initializeSocket, disconnectSocket, getSocket, wsEvents } from '../utils/api';
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

  // Initialize socket connection
  const connectSocket = useCallback(async () => {
    if (state.authenticating) return;

    setState(prev => ({ ...prev, authenticating: true }));

    try {
      console.log('Initializing socket connection...'); // Debug log
      await initializeSocket({ user_id });
      
      setState(prev => ({ 
        ...prev, 
        connected: true,
        authenticating: false
      }));
      console.log('Socket connection established'); // Debug log
    } catch (error) {
      console.error('Socket connection failed:', error); // Debug log
      setState(prev => ({ 
        ...prev, 
        connected: false,
        authenticating: false
      }));
      
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [user_id, state.authenticating, onError]);

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

    const handleError = (error: ErrorEvent) => {
      onError?.(new Error(error.message));
    };

    // Handler factory to ensure we always return a function
    const createHandler = <T extends unknown>(callback?: (data: T) => void) => 
      (data: T) => callback?.(data);

    // Connection events
    socket.on(WS_EVENTS.CONNECT, handleConnect);
    socket.on(WS_EVENTS.DISCONNECT, handleDisconnect);
    socket.on('reconnect', () => onReconnect?.());
    socket.on(WS_EVENTS.ERROR, handleError);

    // User info
    socket.on(WS_EVENTS.USER_INFO, createHandler<UserInfo>(onUserInfo));

    // Room events
    socket.on(WS_EVENTS.ROOM_STATE, createHandler<RoomStateEvent>(onRoomState));
    socket.on(WS_EVENTS.ROOM_USER_JOINED, createHandler<RoomJoinEvent>(onJoin));
    socket.on(WS_EVENTS.ROOM_USER_LEFT, createHandler<RoomLeaveEvent>(onLeave));
    socket.on(WS_EVENTS.CURSOR_UPDATE, createHandler<CursorMoveEvent>(onCursorMove));

    // Comment events
    socket.on(WS_EVENTS.COMMENT_CREATED, createHandler<CommentCreateEvent>(onCommentCreate));
    socket.on(WS_EVENTS.COMMENT_UPDATED, createHandler<CommentUpdateEvent>(onCommentUpdate));
    socket.on(WS_EVENTS.COMMENT_DELETED, createHandler<CommentDeleteEvent>(onCommentDelete));

    // Reply events
    socket.on(WS_EVENTS.REPLY_CREATED, createHandler<ReplyCreateEvent>(onReplyCreate));
    socket.on(WS_EVENTS.REPLY_UPDATED, createHandler<ReplyUpdateEvent>(onReplyUpdate));
    socket.on(WS_EVENTS.REPLY_DELETED, createHandler<ReplyDeleteEvent>(onReplyDelete));

    return () => {
      socket.off(WS_EVENTS.CONNECT, handleConnect);
      socket.off(WS_EVENTS.DISCONNECT, handleDisconnect);
      socket.off('reconnect');
      socket.off(WS_EVENTS.ERROR, handleError);
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
    state.currentRoom,
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
  const updateCursor = useCallback((position: Point) => {
    if (!state.connected || !state.currentRoom) return;
    wsEvents.moveCursor(state.currentRoom, position);
  }, [state.connected, state.currentRoom]);

  return {
    socket: getSocket(),
    connected: state.connected,
    authenticating: state.authenticating,
    currentRoom: state.currentRoom,
    joinRoom,
    leaveRoom,
    updateCursor,
  };
};