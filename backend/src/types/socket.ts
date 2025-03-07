// types/socket.ts

import { Socket } from 'socket.io';

/**
 * User position in the map
 */
export interface Position {
  lng: number;
  lat: number;
}

/**
 * Room user information
 */
export interface RoomUser {
  id: string;
  name: string;
  position: Position;
}

/**
 * Socket user context passed to handlers
 */
export interface SocketUser {
  socket: Socket;
  id: string;
  name: string;
  currentRoom: string | null;
}

/**
 * Map of room IDs to maps of user IDs to users
 */
export interface Rooms {
  [roomId: string]: {
    [userId: string]: RoomUser;
  };
}

/**
 * Selection state of a user
 */
export interface FeatureSelection {
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
 * Drag state of features
 */
export interface DragState {
  userId: string;
  userName: string;
  featureIds: number[];
  offset: {
    lng: number;
    lat: number;
  };
}