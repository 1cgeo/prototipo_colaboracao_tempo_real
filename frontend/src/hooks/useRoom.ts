import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Room, RoomDetails, RoomCreateInput, RoomUpdateInput, 
  User, RoomStateEvent, CursorPosition,
  RoomJoinEvent, RoomLeaveEvent, CursorMoveEvent
} from '../types';
import { roomApi } from '../utils/api';
import { useWebSocket } from './useWebSocket';

interface UseRoomOptions {
  userId: string;
  onError?: (error: Error) => void;
}

interface RoomState {
  currentRoom: RoomDetails | null;
  users: User[];
  cursors: Record<string, CursorPosition>;
  activeUsers: number;
  loading: boolean;
  error: Error | null;
  connected: boolean;
}

const initialState: RoomState = {
  currentRoom: null,
  users: [],
  cursors: {},
  activeUsers: 0,
  loading: false,
  error: null,
  connected: false
};

export const useRoom = ({ userId, onError }: UseRoomOptions) => {
  const [state, setState] = useState<RoomState>(initialState);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // WebSocket integration
  const { 
    joinRoom: wsJoinRoom, 
    leaveRoom: wsLeaveRoom, 
    updateCursor, 
    connected 
  } = useWebSocket({
    user_id: userId,
    onRoomState: (event: RoomStateEvent) => {
      setState(prev => ({
        ...prev,
        users: event.users,
        cursors: event.cursors.reduce<Record<string, CursorPosition>>((acc, cursor) => ({
          ...acc,
          [cursor.user_id]: cursor
        }), {}),
        activeUsers: event.users.length
      }));
      reconnectAttemptsRef.current = 0;
    },
    onJoin: (event: RoomJoinEvent) => {
      setState(prev => ({
        ...prev,
        users: [...prev.users.filter(u => u.id !== event.user_id), {
          id: event.user_id,
          display_name: event.display_name,
          joined_at: new Date(event.timestamp).toISOString()
        }],
        activeUsers: prev.activeUsers + 1
      }));
    },
    onLeave: (event: RoomLeaveEvent) => {
      setState(prev => {
        const newUsers = prev.users.filter(u => u.id !== event.user_id);
        const newCursors = { ...prev.cursors };
        delete newCursors[event.user_id];

        return {
          ...prev,
          users: newUsers,
          cursors: newCursors,
          activeUsers: prev.activeUsers - 1
        };
      });
    },
    onCursorMove: (event: CursorMoveEvent) => {
      setState(prev => ({
        ...prev,
        cursors: {
          ...prev.cursors,
          [event.user_id]: {
            user_id: event.user_id,
            location: event.location,
            timestamp: event.timestamp
          }
        }
      }));
    },
    onError: (error: Error) => {
      setState(prev => ({ ...prev, error }));
      onError?.(error);
    },
    onReconnect: async () => {
      if (state.currentRoom && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        try {
          await loadRoom(state.currentRoom.uuid);
          wsJoinRoom(state.currentRoom.uuid);
        } catch (error) {
          console.error('Failed to reconnect to room:', error);
          setState(prev => ({ ...prev, error: error as Error }));
          onError?.(error as Error);
        }
      }
    }
  });

  // Load room data
  const loadRoom = useCallback(async (roomId: string) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const room = await roomApi.get(roomId);
      setState(prev => ({
        ...prev,
        currentRoom: room,
        users: room.users,
        activeUsers: room.active_users_count,
        error: null,
        loading: false
      }));
      return room;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        error: err,
        loading: false
      }));
      onError?.(err);
      throw err;
    }
  }, [onError]);

  // Join room with state synchronization
  const joinRoom = useCallback(async (roomId: string) => {
    if (!connected) {
      throw new Error('WebSocket not connected');
    }

    try {
      const room = await loadRoom(roomId);
      wsJoinRoom(roomId);
      return room;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, error: err }));
      onError?.(err);
      throw err;
    }
  }, [connected, loadRoom, wsJoinRoom, onError]);

  // Leave room and cleanup state
  const leaveRoom = useCallback(() => {
    if (state.currentRoom) {
      wsLeaveRoom(state.currentRoom.uuid);
      setState(initialState);
      reconnectAttemptsRef.current = 0;
    }
  }, [state.currentRoom, wsLeaveRoom]);

  // Room CRUD operations
  const createRoom = useCallback(async (input: RoomCreateInput): Promise<Room> => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const room = await roomApi.create(input);
      setState(prev => ({ ...prev, error: null, loading: false }));
      return room;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, error: err, loading: false }));
      onError?.(err);
      throw err;
    }
  }, [onError]);

  const updateRoom = useCallback(async (roomId: string, input: RoomUpdateInput): Promise<Room> => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const room = await roomApi.update(roomId, input);
      setState(prev => ({
        ...prev,
        currentRoom: state.currentRoom?.uuid === roomId
          ? { ...state.currentRoom, ...room }
          : state.currentRoom,
        error: null,
        loading: false
      }));
      return room;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, error: err, loading: false }));
      onError?.(err);
      throw err;
    }
  }, [state.currentRoom, onError]);

  const deleteRoom = useCallback(async (roomId: string): Promise<void> => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      await roomApi.delete(roomId);
      if (state.currentRoom?.uuid === roomId) {
        leaveRoom();
      }
      setState(prev => ({ ...prev, error: null, loading: false }));
    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, error: err, loading: false }));
      onError?.(err);
      throw err;
    }
  }, [state.currentRoom, leaveRoom, onError]);

  // Update connection state effect
  useEffect(() => {
    setState(prev => ({ ...prev, connected }));
  }, [connected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    currentRoom: state.currentRoom,
    users: state.users,
    cursors: state.cursors,
    activeUsers: state.activeUsers,
    loading: state.loading,
    error: state.error,
    connected: state.connected,
    joinRoom,
    leaveRoom,
    createRoom,
    updateRoom,
    deleteRoom,
    moveCursor: updateCursor,
    getUser: (userId: string) => state.users.find(user => user.id === userId),
    isUserInRoom: (userId: string) => state.users.some(user => user.id === userId),
    getUserCursor: (userId: string) => state.cursors[userId]
  };
};