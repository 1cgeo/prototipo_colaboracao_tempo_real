import React, { createContext, useContext, useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Room, User, Point, Activity,
  RoomJoinEvent, RoomLeaveEvent, CursorMoveEvent
} from '../types';
import { useWebSocket, useActivity } from '../hooks';
import { roomApi } from '../utils/api';

interface CursorPosition {
  position: Point;
  timestamp: number;
}

interface CollaborationContextState {
  socket: Socket | null;
  connected: boolean;
  currentRoom: Room | null;
  users: User[];
  cursors: Record<string, CursorPosition>;
  activities: Activity[];
  error: Error | null;
}

interface CollaborationContextActions {
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  updateCursor: (position: Point) => void;
}

const CollaborationContext = createContext<
  | (CollaborationContextState & CollaborationContextActions)
  | undefined
>(undefined);

interface CollaborationProviderProps {
  children: React.ReactNode;
  userId: string;
  displayName: string;
}

export const CollaborationProvider: React.FC<CollaborationProviderProps> = ({
  children,
  userId,
  displayName,
}) => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorPosition>>({});
  const [error, setError] = useState<Error | null>(null);

  // Initialize WebSocket with room event handlers
  const {
    socket,
    connected,
    joinRoom: wsJoinRoom,
    leaveRoom: wsLeaveRoom,
    updateCursor: wsUpdateCursor
  } = useWebSocket({
    userId,
    displayName,
    onError: setError,
    onJoin: (event: RoomJoinEvent) => {
      setUsers(prev => [...prev, {
        id: event.userId,
        displayName: event.displayName,
        joinedAt: new Date(event.timestamp).toISOString()
      }]);
    },
    onLeave: (event: RoomLeaveEvent) => {
      setUsers(prev => prev.filter(user => user.id !== event.userId));
      setCursors(prev => {
        const next = { ...prev };
        delete next[event.userId];
        return next;
      });
    },
    onCursorMove: (event: CursorMoveEvent) => {
      setCursors(prev => ({
        ...prev,
        [event.userId]: {
          position: event.location,
          timestamp: event.timestamp
        }
      }));
    }
  });

  // Handle activities
  const { activities, addActivity } = useActivity({
    roomId: currentRoom?.uuid || null,
    onError: setError
  });

  useEffect(() => {
    if (!socket) return;

    socket.on('activity', addActivity);

    return () => {
      socket.off('activity', addActivity);
    };
  }, [socket, addActivity]);

  // Join room
  const joinRoom = async (roomId: string) => {
    if (!socket || !connected) {
      throw new Error('Socket not connected');
    }

    try {
      const room = await roomApi.get(roomId);
      
      wsJoinRoom(roomId);
      setCurrentRoom(room);
      setCursors({});

    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  // Leave room
  const leaveRoom = () => {
    if (!socket || !currentRoom) return;

    wsLeaveRoom(currentRoom.uuid);
    setCurrentRoom(null);
    setUsers([]);
    setCursors({});
  };

  // Update cursor position
  const updateCursor = (position: Point) => {
    if (!currentRoom) return;
    wsUpdateCursor(currentRoom.uuid, position.coordinates);
  };

  const value: CollaborationContextState & CollaborationContextActions = {
    socket,
    connected,
    currentRoom,
    users,
    cursors,
    activities,
    error,
    joinRoom,
    leaveRoom,
    updateCursor
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};

export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (context === undefined) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};