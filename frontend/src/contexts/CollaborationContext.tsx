import React, { createContext, useContext, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Room, RoomDetails, User, Point, Activity,
  CursorPosition, UserInfo, RoomJoinEvent,
  RoomStateEvent, CursorMoveEvent
} from '../types';
import { useWebSocket, useActivity, useRoom } from '../hooks';
import { storeUserInfo } from '../services/auth';

interface CollaborationContextState {
  socket: Socket | null;
  connected: boolean;
  authenticating: boolean;
  currentUser: UserInfo | null;
  currentRoom: RoomDetails | null;
  users: User[];
  cursors: Record<string, CursorPosition>;
  activities: Activity[];
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
  createRoom: (input: { name: string; description: string }) => Promise<Room>;
  updateRoom: (roomId: string, input: { name?: string; description?: string }) => Promise<Room>;
  deleteRoom: (roomId: string) => Promise<void>;
  isUserInRoom: (userId: string) => boolean;
  getUserCursor: (userId: string) => CursorPosition | undefined;
}

const CollaborationContext = createContext<
  | (CollaborationContextState & CollaborationContextActions)
  | undefined
>(undefined);

interface CollaborationProviderProps {
  children: React.ReactNode;
  userId: string;
}

export const CollaborationProvider: React.FC<CollaborationProviderProps> = ({
  children,
  userId
}) => {
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [userNamesCache, setUserNamesCache] = useState<Record<string, string>>({});

  // Handle user info received
  const handleUserInfo = useCallback((info: UserInfo) => {
    setCurrentUser(info);
    setUserNamesCache(prev => ({
      ...prev,
      [info.user_id]: info.display_name
    }));
    storeUserInfo(info);
  }, []);

  // Handle room state received
  const handleRoomState = useCallback((event: RoomStateEvent) => {
    // Update user names cache with all users from room
    event.users.forEach(user => {
      setUserNamesCache(prev => ({
        ...prev,
        [user.id]: user.display_name
      }));
    });
  }, []);

  // Initialize useRoom hook
  const {
    currentRoom,
    users,
    cursors,
    loading: roomLoading,
    error: roomError,
    connected,
    joinRoom: roomJoin,
    leaveRoom: roomLeave,
    createRoom,
    updateRoom,
    deleteRoom,
    moveCursor,
    isUserInRoom,
    getUserCursor
  } = useRoom({
    userId,
    onError: setError
  });

  // Initialize WebSocket with all handlers
  const {
    socket,
    connected: wsConnected,
    authenticating,
  } = useWebSocket({
    user_id: userId,
    onUserInfo: handleUserInfo,
    onRoomState: handleRoomState,
    onJoin: (event: RoomJoinEvent) => {
      setUserNamesCache(prev => ({
        ...prev,
        [event.user_id]: event.display_name
      }));
    },
    onCursorMove: (event: CursorMoveEvent) => {
      if (currentRoom?.uuid === event.room_id) {
        // Handle cursor updates only for current room
        setUserNamesCache(prev => ({
          ...prev,
          [event.user_id]: event.user_id in prev ? prev[event.user_id] : 'Unknown User'
        }));
      }
    },
    onError: setError
  });

  // Handle activities with pagination
  const {
    activities,
    loading: activitiesLoading,
    hasMore: hasMoreActivities,
    loadMore: loadMoreActivities,
  } = useActivity({
    roomId: currentRoom?.uuid || null,
    onError: setError
  });

  // Join room with proper state management
  const joinRoom = async (roomId: string) => {
    try {
      await roomJoin(roomId);
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  // Leave room with cleanup
  const leaveRoom = () => {
    if (currentRoom) {
      roomLeave();
    }
  };

  // Update cursor position
  const updateCursor = (position: Point) => {
    if (!currentRoom) return;
    moveCursor([position.coordinates[0], position.coordinates[1]]);
  };

  // Get user display name from cache
  const getUserDisplayName = useCallback((userId: string): string => {
    return userNamesCache[userId] || 'Unknown User';
  }, [userNamesCache]);

  const value: CollaborationContextState & CollaborationContextActions = {
    socket,
    connected: wsConnected && connected,
    authenticating,
    currentUser,
    currentRoom,
    users,
    cursors,
    activities,
    hasMoreActivities,
    loading: roomLoading || activitiesLoading,
    error: error || roomError,
    joinRoom,
    leaveRoom,
    updateCursor,
    getUserDisplayName,
    loadMoreActivities,
    createRoom,
    updateRoom,
    deleteRoom,
    isUserInRoom,
    getUserCursor
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