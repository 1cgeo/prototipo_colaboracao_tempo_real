import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { initializeSocket, disconnectSocket } from '../utils/api';
import { RoomJoinEvent, RoomLeaveEvent, CursorMoveEvent } from '../types';

interface UseWebSocketOptions {
  userId: string;
  displayName: string;
  onJoin?: (event: RoomJoinEvent) => void;
  onLeave?: (event: RoomLeaveEvent) => void;
  onCursorMove?: (event: CursorMoveEvent) => void;
  onError?: (error: Error) => void;
}

const useWebSocket = ({
  userId,
  displayName,
  onJoin,
  onLeave,
  onCursorMove,
  onError
}: UseWebSocketOptions) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const socket = initializeSocket(userId, displayName);
    
    socket.on('connect', () => {
      setSocket(socket);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
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
      disconnectSocket();
    };
  }, [userId, displayName, onJoin, onLeave, onCursorMove, onError]);

  // Emit room join event
  const joinRoom = useCallback((roomId: string) => {
    if (!socket || !connected) {
      throw new Error('Socket not connected');
    }

    socket.emit('room:join', {
      roomId,
      userId,
      displayName,
      timestamp: Date.now()
    });
  }, [socket, connected, userId, displayName]);

  // Emit room leave event
  const leaveRoom = useCallback((roomId: string) => {
    if (!socket || !connected) return;

    socket.emit('room:leave', {
      roomId,
      userId,
      timestamp: Date.now()
    });
  }, [socket, connected, userId]);

  // Emit cursor move event
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
    joinRoom,
    leaveRoom,
    updateCursor
  };
};

export default useWebSocket;