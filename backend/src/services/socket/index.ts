// services/socket/index.ts

import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import config from '../../config/env.js';
import { setupRoomHandlers } from './handlers/room-handler.js';
import { setupFeatureHandlers } from './handlers/feature-handler.js';
import { setupPolygonHandlers } from './handlers/polygon-handler.js';
import { setupUserHandlers } from './handlers/user-handler.js';
import { setupCommentHandlers } from './handlers/comment-handler.js';
import { setupSelectionHandlers } from './handlers/selection-handler.js';
import { SocketUser, Rooms } from '@/types/socket.js';

// Singleton instance of the Socket.IO server
let io: SocketIOServer;

// Global rooms object to track users in each room
const rooms: Rooms = {};

/**
 * Initialize Socket.IO server
 */
export const initializeSocketIO = (server: http.Server): SocketIOServer => {
  console.log('[SOCKET] Initializing Socket.IO server...');
  
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    maxHttpBufferSize: 20e6, // 20 MB for Base64 images
  });
  
  console.log('[SOCKET] Socket.IO server initialized successfully');
  console.log(`[SOCKET] CORS configured for origin: ${config.cors.origin}`);
  
  // Set up connection handler
  io.on('connection', socket => {
    console.log('[SOCKET] User connected:', socket.id);
    
    // Create user context object to be passed to all handlers
    const userContext: SocketUser = {
      socket,
      id: socket.id,
      name: generateRandomName(),
      currentRoom: null
    };
    
    console.log(`[SOCKET] Assigned name "${userContext.name}" to user ${userContext.id}`);
    
    // Set up all handlers
    setupRoomHandlers(io, userContext, rooms);
    setupUserHandlers(io, userContext, rooms);
    setupFeatureHandlers(io, userContext, rooms);
    setupPolygonHandlers(io, userContext, rooms);
    setupCommentHandlers(io, userContext, rooms);
    setupSelectionHandlers(io, userContext, rooms);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`[SOCKET] User ${userContext.name} (${userContext.id}) disconnected`);
      
      if (userContext.currentRoom && rooms[userContext.currentRoom]) {
        delete rooms[userContext.currentRoom][userContext.id];
        socket.to(userContext.currentRoom).emit('user-disconnected', userContext.id);
        
        // Log remaining users in the room
        const remainingUsers = Object.keys(rooms[userContext.currentRoom]).length;
        console.log(`[SOCKET] Room ${userContext.currentRoom} now has ${remainingUsers} users`);
      }
    });
  });
  
  return io;
};

/**
 * Get the Socket.IO server instance
 */
export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
};

/**
 * Get the rooms object
 */
export const getRooms = (): Rooms => {
  return rooms;
};

/**
 * Generate a random user name
 */
function generateRandomName(): string {
  // Implementation from your existing utils/nameGenerator.js
  // This is a placeholder for your existing implementation
  return `User${Math.floor(Math.random() * 10000)}`;
}