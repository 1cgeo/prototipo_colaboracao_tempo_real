import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Room, RoomDetails, User, Point, Activity,
  CursorPosition, UserInfo, RoomJoinEvent,
  RoomStateEvent
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
  const [initialized, setInitialized] = useState(false);
  const userNamesRef = useRef<Record<string, string>>({});

  // Handle user info received
  const handleUserInfo = useCallback((info: UserInfo) => {
    console.log('[Collaboration] Received user info:', info);

    if (!info?.user_id) {
      console.error('[Collaboration] Invalid user info received');
      setError(new Error('Invalid user info received'));
      return;
    }

    try {
      userNamesRef.current[info.user_id] = info.display_name;
      
      setCurrentUser(info);
      setInitialized(true);

      storeUserInfo({
        user_id: info.user_id,
        display_name: info.display_name
      });
      
      console.log('[Collaboration] User info processed successfully');
    } catch (err) {
      console.error('[Collaboration] Error processing user info:', err);
      setError(err instanceof Error ? err : new Error('Failed to process user info'));
    }
  }, []);

  const handleError = useCallback((err: Error) => {
    console.error('[Collaboration] Error:', err);
    setError(err);
  }, []);

  const { currentRoom, users, cursors, loading: roomLoading, error: roomError, connected,
    joinRoom: roomJoin, leaveRoom: roomLeave, createRoom, updateRoom, deleteRoom,
    moveCursor, isUserInRoom, getUserCursor } = useRoom({
    userId,
    onError: handleError
  });

  const { socket, connected: wsConnected, authenticating } = useWebSocket({
    user_id: userId,
    onUserInfo: handleUserInfo,
    onError: handleError,
    onJoin: useCallback((event: RoomJoinEvent) => {
      userNamesRef.current[event.user_id] = event.display_name;
    }, []),
    onRoomState: useCallback((event: RoomStateEvent) => {
      event.users.forEach(user => {
        userNamesRef.current[user.id] = user.display_name;
      });
    }, [])
  });

  const { activities, loading: activitiesLoading, hasMore: hasMoreActivities,
    loadMore: loadMoreActivities } = useActivity({
    roomId: currentRoom?.uuid || null,
    onError: handleError
  });

  const joinRoom = useCallback(async (roomId: string) => {
    try {
      await roomJoin(roomId);
      setError(null);
    } catch (err) {
      handleError(err as Error);
      throw err;
    }
  }, [roomJoin, handleError]);

  const leaveRoom = useCallback(() => {
    if (currentRoom) {
      roomLeave();
    }
  }, [currentRoom, roomLeave]);

  const updateCursor = useCallback((position: Point) => {
    if (!currentRoom) return;
    moveCursor({ 
      type: 'Point',
      coordinates: [position.coordinates[0], position.coordinates[1]] 
    });
  }, [currentRoom, moveCursor]);

  const getUserDisplayName = useCallback((userId: string): string => {
    return userNamesRef.current[userId] || 'Unknown User';
  }, []);

  const loading = roomLoading || activitiesLoading || authenticating || !initialized;

  const value = {
    socket,
    connected: wsConnected && connected,
    authenticating,
    currentUser,
    currentRoom,
    users,
    cursors,
    activities,
    hasMoreActivities,
    loading,
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