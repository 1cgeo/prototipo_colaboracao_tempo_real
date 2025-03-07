// Path: services\socket\feature-registry.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser, Rooms } from '@/types/socket.js';

/**
 * Type for feature handler registration function
 */
export type FeatureHandlerSetup = (
  io: SocketIOServer,
  user: SocketUser,
  rooms: Rooms
) => void;

/**
 * Registry of feature handlers
 */
const featureHandlers: Record<string, FeatureHandlerSetup> = {};

/**
 * Register a new feature handler
 */
export function registerFeatureHandler(
  featureType: string,
  setupFn: FeatureHandlerSetup
): void {
  featureHandlers[featureType] = setupFn;
  console.log(`[SOCKET] Registered handler for feature type: ${featureType}`);
}

/**
 * Set up all registered feature handlers
 */
export function setupAllFeatureHandlers(
  io: SocketIOServer,
  user: SocketUser,
  rooms: Rooms
): void {
  for (const [featureType, setupFn] of Object.entries(featureHandlers)) {
    console.log(`[SOCKET] Setting up ${featureType} feature handler for user ${user.id}`);
    setupFn(io, user, rooms);
  }
}