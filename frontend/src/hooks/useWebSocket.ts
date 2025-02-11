import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { initializeSocket, disconnectSocket } from '../utils/api';
import { 
  RoomJoinEvent, 
  RoomLeaveEvent, 
  CursorMoveEvent,
  AuthenticationSuccess,
  AuthenticationError
} from '../types';

interface UseWebSocketOptions {
  userId: string;
  onAuthSuccess?: (data: AuthenticationSuccess) => void;
  onAuthError?: (error: AuthenticationError) => void;
  onJoin?: (event: RoomJoinEvent) => void;
  onLeave?: (event: RoomLeaveEvent) => void;
  onCursorMove?: (event: CursorMoveEvent) => void;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}

const useWebSocket = ({
  userId,
  onAuthSuccess,
  onAuthError,
  onJoin,
  onLeave,
  onCursorMove,
  onError,
  onReconnect
}: UseWebSocketOptions) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    let mounted = true;
    setAuthenticating(true);

    const connectSocket = async () => {
      try {
        const authData = await initializeSocket(userId);
        if (!mounted) return;

        const socket = window.io;
        if (socket) {
          setSocket(socket);
          setConnected(true);
          onAuthSuccess?.(authData);
        }
      } catch (error) {
        if (!mounted) return;
        setConnected(false);
        onAuthError?.(error as AuthenticationError);
        onError?.(error as Error);
      } finally {
        if (mounted) {
          setAuthenticating(false);
        }
      }
    };

    connectSocket();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [userId, onAuthSuccess, onAuthError, onError]);

  // Setup socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Connection events
    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('reconnect', () => {
      onReconnect?.();
    });

    socket.on('error', (error: Error) => {
      onError?.(error);
    });

    // Room events
    socket.on('room:join', (event: RoomJoinEvent) => {
      onJoin?.(event);
    });

    socket.on('room:leave', (event: RoomLeaveEvent) => {
      onLeave?.(event);
    });

    socket.on('cursor:move', (event: CursorMoveEvent) => {
      onCursorMove?.(event);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
      socket.off('error');
      socket.off('room:join');
      socket.off('room:leave');
      socket.off('cursor:move');
    };
  }, [socket, onJoin, onLeave, onCursorMove, onError, onReconnect]);

  // Emit room join event
  const joinRoom = useCallback((roomId: string) => {
    if (!socket || !connected) {
      throw new Error('Socket not connected');
    }

    socket.emit('room:join', {
      roomId,
      userId,
      timestamp: Date.now()
    });
  }, [socket, connected, userId]);

  // Emit room leave event
  const leaveRoom = useCallback((roomId: string) => {
    if (!socket || !connected) return;

    socket.emit('room:leave', {
      roomId,
      userId,
      timestamp: Date.now()
    });
  }, [socket, connected, userId]);

  // Emit cursor move event with throttling
  const updateCursor = useCallback((roomId: string, coordinates: [number, number]) => {
    if (!socket || !connected) return;

    socket.emit('cursor:move', {
      roomId,
      userId,
      location: {
        type: 'Point',
        coordinates
      },
      timestamp: Date.now()
    });
  }, [socket, connected, userId]);

  return {
    socket,
    connected,
    authenticating,
    joinRoom,
    leaveRoom,
    updateCursor
  };
};

export default useWebSocket;