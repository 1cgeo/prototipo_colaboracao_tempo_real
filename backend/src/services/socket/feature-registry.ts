// services/socket/feature-registry.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser, Rooms } from '../../types/socket.js';

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

/**
 * This provides an easy way to register new feature types.
 * When adding a new feature type:
 * 
 * 1. Create a new handler file: services/socket/handlers/{feature-type}-handler.ts
 * 2. Implement the handler using the FeatureHandlerSetup signature
 * 3. Register it at application startup:
 *
 * ```
 * import { registerFeatureHandler } from './services/socket/feature-registry.js';
 * import { setupNewFeatureHandlers } from './services/socket/handlers/new-feature-handler.js';
 * 
 * registerFeatureHandler('new-feature', setupNewFeatureHandlers);
 * ```
 * 
 * This allows the application to be extended with new feature types
 * without modifying the core socket setup.
 */