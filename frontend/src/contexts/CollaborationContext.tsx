import React, { createContext, useContext, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Room, RoomDetails, User, Point, Activity,
  AuthenticationSuccess, AuthenticationError,
  UIActivity
} from '../types';
import { useWebSocket, useActivity } from '../hooks';

interface CursorPosition {
  position: Point;
  timestamp: number;
}

interface CollaborationContextState {
  socket: Socket | null;
  connected: boolean;
  authenticating: boolean;
  currentUser: AuthenticationSuccess | null;
  currentRoom: RoomDetails | null;
  users: User[];
  cursors: Record<string, CursorPosition>;
  activities: UIActivity[];
  hasMoreActivities: boolean;
  loading: boolean;
  error: Error | null;
}

interface CollaborationContextActions {
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  updateCursor: (position: Point) => void;
  getUserDisplayName: (userId: string) => string;
  loadMoreActivities: () => Promise<void>;
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
  displayName
}) => {
  const [currentUser, setCurrentUser] = useState<AuthenticationSuccess | null>(null);
  const [currentRoom, setCurrentRoom] = useState<RoomDetails | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorPosition>>({});
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  
  // User display names cache
  const [userNamesCache, setUserNamesCache] = useState<Record<string, string>>({});

  // Handle successful authentication
  const handleAuthSuccess = useCallback((data: AuthenticationSuccess) => {
    setCurrentUser(data);
    setUserNamesCache(prev => ({
      ...prev,
      [data.user_id]: data.display_name
    }));
  }, []);

  // Handle authentication error
  const handleAuthError = useCallback((error: AuthenticationError) => {
    setError(new Error(error.message));
  }, []);

  // Initialize WebSocket with all handlers
  const {
    socket,
    connected,
    authenticating,
    joinRoom: wsJoinRoom,
    leaveRoom: wsLeaveRoom,
    updateCursor: wsUpdateCursor
  } = useWebSocket({
    userId,
    displayName,
    onAuthSuccess: handleAuthSuccess,
    onAuthError: handleAuthError,
    onJoin: (event) => {
      setUsers(prev => [...prev, {
        id: event.user_id,
        display_name: event.display_name,
        joined_at: new Date(event.timestamp).toISOString()
      }]);
      setUserNamesCache(prev => ({
        ...prev,
        [event.user_id]: event.display_name
      }));
    },
    onLeave: (event) => {
      setUsers(prev => prev.filter(user => user.id !== event.user_id));
    },
    onCursorMove: (event) => {
      setCursors(prev => ({
        ...prev,
        [event.user_id]: {
          position: event.location,
          timestamp: event.timestamp
        }
      }));
    },
    onError: setError,
    onReconnect: () => {
      // Clear local state on reconnect
      setCursors({});
      if (currentRoom) {
        wsJoinRoom(currentRoom.uuid);
      }
    }
  });

  // Handle activities with pagination and caching
  const {
    activities,
    loading: activitiesLoading,
    hasMore: hasMoreActivities,
    loadMore: loadMoreActivities,
    addActivity,
    filterByType,
    filterByUser,
    getActivitySummary
  } = useActivity({
    roomId: currentRoom?.uuid || null,
    onError: setError
  });

  // Join room
  const joinRoom = async (roomId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/maps/${roomId}`);
      const room = await response.json();
      setCurrentRoom(room);
      wsJoinRoom(roomId);
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Leave room
  const leaveRoom = () => {
    if (currentRoom) {
      wsLeaveRoom(currentRoom.uuid);
      setCurrentRoom(null);
      setUsers([]);
      setCursors({});
    }
  };

  // Update cursor position
  const updateCursor = (position: Point) => {
    if (!currentRoom) return;
    wsUpdateCursor(currentRoom.uuid, position);
  };

  // Get user display name from cache
  const getUserDisplayName = (userId: string): string => {
    return userNamesCache[userId] || 'Unknown User';
  };

  // Socket event handler for activities
  React.useEffect(() => {
    if (!socket) return;

    socket.on('activity', (activity: Activity) => {
      addActivity(activity);
      
      // Update user name cache if needed
      if (activity.user_name && activity.user_id) {
        setUserNamesCache(prev => ({
          ...prev,
          [activity.user_id]: activity.user_name
        }));
      }
    });

    return () => {
      socket.off('activity');
    };
  }, [socket, addActivity]);

  const value: CollaborationContextState & CollaborationContextActions = {
    socket,
    connected,
    authenticating,
    currentUser,
    currentRoom,
    users,
    cursors,
    activities,
    hasMoreActivities,
    loading: loading || activitiesLoading,
    error,
    joinRoom,
    leaveRoom,
    updateCursor,
    getUserDisplayName,
    loadMoreActivities
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