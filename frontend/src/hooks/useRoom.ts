import { useState, useEffect, useCallback } from 'react';
import { Room, RoomCreateInput, RoomUpdateInput, User } from '../types';
import { roomApi } from '../utils/api';
import useWebSocket from './useWebSocket';

interface UseRoomOptions {
  userId: string;
  displayName: string;
}

const useRoom = ({ userId, displayName }: UseRoomOptions) => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize WebSocket with room event handlers
  const { connected, joinRoom: wsJoinRoom, leaveRoom: wsLeaveRoom } = useWebSocket({
    userId,
    displayName,
    onJoin: (event) => {
      setUsers(prev => [...prev, {
        id: event.userId,
        displayName: event.displayName,
        joinedAt: new Date(event.timestamp).toISOString()
      }]);
    },
    onLeave: (event) => {
      setUsers(prev => prev.filter(user => user.id !== event.userId));
    },
    onError: (error) => {
      setError(error);
    }
  });

  // Load room data
  const loadRoom = useCallback(async (roomId: string) => {
    setLoading(true);
    try {
      const room = await roomApi.get(roomId);
      setCurrentRoom(room);
      setError(null);
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Join room
  const joinRoom = useCallback(async (roomId: string) => {
    if (!connected) {
      throw new Error('WebSocket not connected');
    }

    try {
      await loadRoom(roomId);
      wsJoinRoom(roomId);
      setError(null);
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [connected, loadRoom, wsJoinRoom]);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (currentRoom) {
      wsLeaveRoom(currentRoom.uuid);
      setCurrentRoom(null);
      setUsers([]);
    }
  }, [currentRoom, wsLeaveRoom]);

  // Create room
  const createRoom = useCallback(async (input: RoomCreateInput) => {
    setLoading(true);
    try {
      const room = await roomApi.create(input);
      setError(null);
      return room;
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update room
  const updateRoom = useCallback(async (roomId: string, input: RoomUpdateInput) => {
    setLoading(true);
    try {
      const room = await roomApi.update(roomId, input);
      if (currentRoom?.uuid === roomId) {
        setCurrentRoom(room);
      }
      setError(null);
      return room;
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentRoom]);

  // Delete room
  const deleteRoom = useCallback(async (roomId: string) => {
    setLoading(true);
    try {
      await roomApi.delete(roomId);
      if (currentRoom?.uuid === roomId) {
        setCurrentRoom(null);
        setUsers([]);
      }
      setError(null);
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    currentRoom,
    users,
    loading,
    error,
    joinRoom,
    leaveRoom,
    createRoom,
    updateRoom,
    deleteRoom
  };
};

export default useRoom;