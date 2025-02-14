import { useEffect, useState, useCallback, useRef } from 'react';
import { wsEvents } from '../utils/websocketEvents';
import { initializeSocket, getSocket } from '../config/socket';
import { WS_EVENTS } from '../types';
import { 
  UserInfo,
  RoomStateEvent,
  RoomJoinEvent,
  RoomLeaveEvent,
  CursorMoveEvent,
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
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useWebSocket = ({
  user_id,
  onUserInfo,
  onRoomState,
  onJoin,
  onLeave,
  onCursorMove,
  onError,
  onReconnect
}: UseWebSocketOptions) => {
  const [connected, setConnected] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const mountedRef = useRef(false);
  const initializationAttemptRef = useRef(false);
  const currentRoomRef = useRef<string | null>(null);

  // Socket event handlers - memoized
  const handleError = useCallback((error: ErrorEvent) => {
    if (!mountedRef.current) return;
    onError?.(new Error(error.message));
  }, [onError]);

  const handleUserInfo = useCallback((data: UserInfo) => {
    if (!mountedRef.current) return;
    onUserInfo?.(data);
  }, [onUserInfo]);

  const handleRoomState = useCallback((state: RoomStateEvent) => {
    if (!mountedRef.current) return;
    onRoomState?.(state);
  }, [onRoomState]);

  const handleJoin = useCallback((event: RoomJoinEvent) => {
    if (!mountedRef.current) return;
    onJoin?.(event);
  }, [onJoin]);

  const handleLeave = useCallback((event: RoomLeaveEvent) => {
    if (!mountedRef.current) return;
    onLeave?.(event);
  }, [onLeave]);

  const handleCursorMove = useCallback((event: CursorMoveEvent) => {
    if (!mountedRef.current) return;
    onCursorMove?.(event);
  }, [onCursorMove]);

  const handleConnect = useCallback(() => {
    if (!mountedRef.current) return;
    setConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    if (!mountedRef.current) return;
    setConnected(false);
  }, []);

  const handleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    onReconnect?.();
  }, [onReconnect]);

  // Initialize socket and setup event listeners
  useEffect(() => {
    mountedRef.current = true;

    const setupSocket = async () => {
      if (initializationAttemptRef.current) return;
      initializationAttemptRef.current = true;

      setAuthenticating(true);
      try {
        await initializeSocket(API_BASE_URL, {
          user_id,
          display_name: `User-${user_id.slice(0, 6)}`
        });

        const socket = getSocket();
        if (!socket || !mountedRef.current) return;

        socket.on('error', handleError);
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('reconnect', handleReconnect);
        socket.on(WS_EVENTS.USER_INFO, handleUserInfo);
        socket.on(WS_EVENTS.ROOM_STATE, handleRoomState);
        socket.on(WS_EVENTS.ROOM_USER_JOINED, handleJoin);
        socket.on(WS_EVENTS.ROOM_USER_LEFT, handleLeave);
        socket.on(WS_EVENTS.CURSOR_UPDATE, handleCursorMove);

        handleConnect();
      } catch (error) {
        if (!mountedRef.current) return;
        setConnected(false);
        onError?.(error instanceof Error ? error : new Error('Failed to initialize socket'));
      } finally {
        if (mountedRef.current) {
          setAuthenticating(false);
          initializationAttemptRef.current = false;
        }
      }
    };

    setupSocket();

    return () => {
      mountedRef.current = false;
      const socket = getSocket();
      if (socket) {
        socket.off('error', handleError);
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('reconnect', handleReconnect);
        socket.off(WS_EVENTS.USER_INFO, handleUserInfo);
        socket.off(WS_EVENTS.ROOM_STATE, handleRoomState);
        socket.off(WS_EVENTS.ROOM_USER_JOINED, handleJoin);
        socket.off(WS_EVENTS.ROOM_USER_LEFT, handleLeave);
        socket.off(WS_EVENTS.CURSOR_UPDATE, handleCursorMove);
      }
    };
  }, [
    user_id,
    handleError,
    handleConnect,
    handleDisconnect,
    handleReconnect,
    handleUserInfo,
    handleRoomState,
    handleJoin,
    handleLeave,
    handleCursorMove,
    onError
  ]);

  const joinRoom = useCallback((roomId: string) => {
    if (!connected) throw new Error('Socket not connected');
    currentRoomRef.current = roomId;
    wsEvents.joinRoom(roomId, user_id, `User-${user_id.slice(0, 6)}`);
  }, [user_id, connected]);

  const leaveRoom = useCallback((roomId: string) => {
    if (!connected) return;
    currentRoomRef.current = null;
    wsEvents.leaveRoom(roomId, user_id);
  }, [user_id, connected]);

  const updateCursor = useCallback((position: Point) => {
    const socket = getSocket();
    if (!socket || !connected || !currentRoomRef.current) return;
    wsEvents.moveCursor(currentRoomRef.current, user_id, position);
  }, [user_id, connected]);

  return {
    socket: getSocket(),
    connected,
    authenticating,
    currentRoom: currentRoomRef.current,
    joinRoom,
    leaveRoom,
    updateCursor
  };
};