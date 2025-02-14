import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
  const [initializationComplete, setInitializationComplete] = useState(false);

  console.log('[Collaboration] Provider initializing with userId:', userId);

  // Handle user info received
  const handleUserInfo = useCallback((info: UserInfo) => {
    console.log('[Collaboration] Received user info:', info);
    
    if (!info || !info.user_id) {
      console.error('[Collaboration] Invalid user info received:', info);
      setError(new Error('Invalid user info received from server'));
      return;
    }
    
    setCurrentUser(info);
    setUserNamesCache(prev => ({
      ...prev,
      [info.user_id]: info.display_name
    }));
    
    try {
      storeUserInfo({
        user_id: info.user_id,
        display_name: info.display_name
      });
      console.log('[Collaboration] Stored user info successfully');
    } catch (error) {
      console.error('[Collaboration] Failed to store user info:', error);
    }

    setInitializationComplete(true);
  }, []);

  // Handle room state received
  const handleRoomState = useCallback((event: RoomStateEvent) => {
    console.log('[Collaboration] Received room state:', event);
    
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
    onError: error => {
      console.error('[Collaboration] Room error:', error);
      setError(error);
    }
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
      console.log('[Collaboration] User joined:', event);
      setUserNamesCache(prev => ({
        ...prev,
        [event.user_id]: event.display_name
      }));
    },
    onCursorMove: (event: CursorMoveEvent) => {
      if (currentRoom?.uuid === event.room_id) {
        setUserNamesCache(prev => ({
          ...prev,
          [event.user_id]: event.user_id in prev ? prev[event.user_id] : 'Unknown User'
        }));
      }
    },
    onError: (error: Error) => {
      console.error('[Collaboration] WebSocket error:', error);
      setError(error);
    }
  });

  // Handle activities with pagination
  const {
    activities,
    loading: activitiesLoading,
    hasMore: hasMoreActivities,
    loadMore: loadMoreActivities,
  } = useActivity({
    roomId: currentRoom?.uuid || null,
    onError: (error: Error) => {
      console.error('[Collaboration] Activity error:', error);
      setError(error);
    }
  });

  // Join room with proper state management
  const joinRoom = async (roomId: string) => {
    console.log('[Collaboration] Attempting to join room:', roomId);
    try {
      await roomJoin(roomId);
      setError(null);
    } catch (error) {
      console.error('[Collaboration] Failed to join room:', error);
      setError(error as Error);
      throw error;
    }
  };

  // Leave room with cleanup
  const leaveRoom = () => {
    console.log('[Collaboration] Leaving current room');
    if (currentRoom) {
      roomLeave();
    }
  };

  // Update cursor position
  const updateCursor = (position: Point) => {
    if (!currentRoom) return;
    moveCursor({ 
      type: 'Point',
      coordinates: [position.coordinates[0], position.coordinates[1]] 
    });
  };

  // Get user display name from cache
  const getUserDisplayName = useCallback((userId: string): string => {
    return userNamesCache[userId] || 'Unknown User';
  }, [userNamesCache]);

  // Monitor initialization status
  useEffect(() => {
    if (!initializationComplete && !authenticating) {
      console.log('[Collaboration] Still waiting for initialization...');
    }
  }, [initializationComplete, authenticating]);

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
    loading: roomLoading || activitiesLoading || !initializationComplete,
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

  // Log major state changes
  useEffect(() => {
    console.log('[Collaboration] State updated:', {
      connected: wsConnected && connected,
      authenticating,
      hasUser: !!currentUser,
      hasRoom: !!currentRoom,
      userCount: users.length,
      loading: roomLoading || activitiesLoading || !initializationComplete,
      error: error || roomError
    });
  }, [
    wsConnected, 
    connected, 
    authenticating, 
    currentUser, 
    currentRoom, 
    users, 
    roomLoading, 
    activitiesLoading, 
    initializationComplete,
    error,
    roomError
  ]);

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