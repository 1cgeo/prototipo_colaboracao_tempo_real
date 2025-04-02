// Path: types\socket.ts

import { Socket } from 'socket.io';

/**
 * User position in the map
 */
export interface Position {
  lng: number;
  lat: number;
}

// Internal types - only used within socket handlers
interface RoomUser {
  id: string;
  name: string;
  position: Position;
  status?: 'active' | 'away' | 'offline';
  joinedAt?: number;
}

interface ConnectionState {
  isReconnection: boolean;
  reconnectCount: number;
  lastSeen: number;
}

/**
 * Socket user context passed to handlers
 */
export interface SocketUser {
  socket: Socket;
  id: string;
  name: string;
  currentRoom: string | null;
  connectionState?: ConnectionState;
}

/**
 * Map of room IDs to maps of user IDs to users
 */
export interface Rooms {
  [roomId: string]: {
    [userId: string]: RoomUser;
  };
}

// Internal types that only need to be used within the socket handlers
interface FeatureSelection {
  userId: string;
  userName: string;
  featureIds: number[];
}

/**
 * Map of feature IDs to selections
 */
export interface SelectionState {
  [featureId: number]: FeatureSelection;
}

/**
 * User connection state tracking 
 */
export interface UserConnectionState {
  lastSeen: number;
  lastActivityByMap: {
    [mapId: number]: number;
  };
  reconnectCount: number;
  lastRoom: string | null;
  userName: string;
}
