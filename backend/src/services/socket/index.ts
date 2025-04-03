// Path: services\socket\index.ts

import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import config from '../../config/env.js';
import { setupRoomHandlers } from './handlers/room-handler.js';
import { setupFeatureHandlers } from './handlers/feature-handler.js';
import { setupPolygonHandlers } from './handlers/polygon-handler.js';
import { setupUserHandlers } from './handlers/user-handler.js';
import { setupCommentHandlers } from './handlers/comment-handler.js';
import { setupSelectionHandlers } from './handlers/selection-handler.js';
import { setupConnectionMonitor } from './quality-monitor.js';
import { SocketUser, Rooms, UserConnectionState } from '@/types/socket.js';
import { generateRandomName } from '../../utils/nameGenerator.js';

// Configuration constants for user connections
const USER_INACTIVE_TIMEOUT = 60 * 60 * 1000; // 1 hour (reduced from 4 hours)
const USER_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes (reduced from 30 minutes)
const MAX_STORED_USERS = 10000; // Maximum number of users to store in memory

// Singleton instance of the Socket.IO server
let io: SocketIOServer;

// Global rooms object to track users in each room
const rooms: Rooms = {};

// Track user connection states across reconnects
const userConnections: Record<string, UserConnectionState> = {};

/**
 * Initialize Socket.IO server with robust connection settings
 */
export const initializeSocketIO = (server: http.Server): SocketIOServer => {
  console.log('[SOCKET] Initializing Socket.IO server...');
  
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    // Enhanced connection settings for unreliable networks
    pingInterval: 10000,      // Send ping every 10 seconds (default: 25s)
    pingTimeout: 15000,       // Consider disconnected after 15s without response (default: 20s)
    connectTimeout: 30000,    // Connection timeout (default: 45s)
    // These options will be sent to client
    connectionStateRecovery: {
      // Enable built-in Socket.IO state recovery
      // INCREASED from 3 minutes to 10 minutes for field users with spotty connections
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    }
  });
  
  console.log('[SOCKET] Socket.IO server initialized successfully');
  console.log(`[SOCKET] CORS configured for origin: ${config.cors.origin}`);
  console.log('[SOCKET] Enhanced connection reliability settings activated');
  console.log('[SOCKET] Disconnection recovery window: 10 minutes');
  
  // Set up connection handler
  io.on('connection', (socket) => {
    const isReconnection = socket.recovered;
    let clientId = socket.handshake.auth.clientId || socket.id;
    
    // Check if this is a reconnect with a known client ID
    if (socket.handshake.auth.clientId && userConnections[socket.handshake.auth.clientId]) {
      clientId = socket.handshake.auth.clientId;
      console.log(`[SOCKET] User reconnected with client ID: ${clientId}`);
    } else {
      console.log(`[SOCKET] New user connected: ${clientId}`);
    }
    
    // Initialize or update user connection state
    if (!userConnections[clientId]) {
      // If we have too many stored users, clean up the oldest
      if (Object.keys(userConnections).length >= MAX_STORED_USERS) {
        cleanupOldestUsers(50); // Remove 50 oldest users to make space
      }
      
      userConnections[clientId] = {
        lastSeen: Date.now(),
        lastActivityByMap: {},
        reconnectCount: 0,
        lastRoom: null,
        userName: generateRandomName()
      };
    } else {
      userConnections[clientId].reconnectCount++;
      userConnections[clientId].lastSeen = Date.now();
    }
    
    // Create user context object to be passed to all handlers
    const userContext: SocketUser = {
      socket,
      id: clientId,
      name: userConnections[clientId].userName,
      currentRoom: userConnections[clientId].lastRoom,
      connectionState: {
        isReconnection,
        reconnectCount: userConnections[clientId].reconnectCount,
        lastSeen: userConnections[clientId].lastSeen
      }
    };
    
    console.log(`[SOCKET] User context created:
    - ID: ${userContext.id}
    - Name: ${userContext.name}
    - Reconnection: ${isReconnection ? 'Yes' : 'No'}
    - Reconnect count: ${userConnections[clientId].reconnectCount}
    - Last room: ${userConnections[clientId].lastRoom || 'None'}`);
    
    // If reconnecting, automatically rejoin previous room
    if (isReconnection && userConnections[clientId].lastRoom) {
      const roomId = userConnections[clientId].lastRoom;
      if (roomId) {  // Add null check here
        const mapId = parseInt(roomId.replace('map-', ''), 10);
        
        console.log(`[SOCKET] Auto-rejoining user ${clientId} to previous room ${roomId}`);
        socket.emit('auto-rejoin', { 
          mapId, 
          lastActivity: userConnections[clientId].lastActivityByMap[mapId] || 0 
        });
      }
    }
    
    // Set up connection quality monitoring
    setupConnectionMonitor(socket, userContext);
    
    // Set up all handlers
    setupRoomHandlers(io, userContext, rooms, userConnections);
    setupUserHandlers(io, userContext, rooms);
    setupFeatureHandlers(io, userContext, rooms);
    setupPolygonHandlers(io, userContext, rooms);
    setupCommentHandlers(io, userContext, rooms);
    setupSelectionHandlers(io, userContext, rooms);
    
    // Send client their connection info for recovery purposes
    socket.emit('connection-info', { 
      clientId, 
      reconnectCount: userConnections[clientId].reconnectCount,
      serverTime: Date.now()
    });
    
    // Keepalive ping/pong for VPN scenarios that might drop inactive connections
    socket.on('keepalive-ping', (callback) => {
      if (userConnections[clientId]) {
        userConnections[clientId].lastSeen = Date.now();
      }
      
      // Respond with current server time for client-side latency calculation
      if (typeof callback === 'function') {
        callback({
          serverTime: Date.now(),
          reconnects: userConnections[clientId]?.reconnectCount || 0
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] User ${userContext.name} (${clientId}) disconnected. Reason: ${reason}`);
      
      // Update last seen timestamp
      if (userConnections[clientId]) {
        userConnections[clientId].lastSeen = Date.now();
        
        // Only remove from room if not expecting reconnect
        if (reason === 'client namespace disconnect' || reason === 'server namespace disconnect') {
          cleanupUser(userContext);
          delete userConnections[clientId];
        } else {
          // For temporary disconnects, keep the user in the system but mark as away in rooms
          if (userContext.currentRoom && rooms[userContext.currentRoom] && rooms[userContext.currentRoom][clientId]) {
            rooms[userContext.currentRoom][clientId].status = 'away';
            socket.to(userContext.currentRoom).emit('user-away', clientId);
            console.log(`[SOCKET] User ${clientId} marked as away in room ${userContext.currentRoom}`);
          }
        }
      } else {
        // For unknown users, just clean up
        cleanupUser(userContext);
      }
    });
  });
  
  // Set interval to clean up stale connections (users disconnected > 1 hour)
  // REDUCED from 4 hours to 1 hour
  setInterval(() => {
    cleanupStaleUsers();
  }, USER_CLEANUP_INTERVAL);
  
  return io;
};

/**
 * Clean up stale user connections
 */
function cleanupStaleUsers(): void {
  const now = Date.now();
  let cleanupCount = 0;
  
  for (const clientId in userConnections) {
    if (now - userConnections[clientId].lastSeen > USER_INACTIVE_TIMEOUT) {
      cleanupCount++;
      
      // Clean up user from all rooms
      if (userConnections[clientId].lastRoom && rooms[userConnections[clientId].lastRoom]) {
        delete rooms[userConnections[clientId].lastRoom][clientId];
        io.to(userConnections[clientId].lastRoom).emit('user-disconnected', clientId);
      }
      
      delete userConnections[clientId];
    }
  }
  
  if (cleanupCount > 0) {
    console.log(`[SOCKET] Cleaned up ${cleanupCount} stale user connection(s)`);
    console.log(`[SOCKET] Current user connections: ${Object.keys(userConnections).length}`);
  }
}

/**
 * Clean up oldest users when reaching maximum limit
 */
function cleanupOldestUsers(count: number): void {
  // Get userIds sorted by lastSeen (oldest first)
  const userIds = Object.keys(userConnections).sort(
    (a, b) => userConnections[a].lastSeen - userConnections[b].lastSeen
  );
  
  // Take only the oldest 'count' users or all if less than count
  const usersToRemove = userIds.slice(0, Math.min(count, userIds.length));
  
  for (const userId of usersToRemove) {
    // Remove from rooms if present
    if (userConnections[userId].lastRoom && rooms[userConnections[userId].lastRoom]) {
      delete rooms[userConnections[userId].lastRoom][userId];
    }
    
    // Delete the user connection state
    delete userConnections[userId];
  }
  
  console.log(`[SOCKET] Memory management: removed ${usersToRemove.length} oldest user connections`);
  console.log(`[SOCKET] Current user connections: ${Object.keys(userConnections).length}`);
}

/**
 * Clean up a user from all rooms
 */
function cleanupUser(userContext: SocketUser): void {
  if (userContext.currentRoom && rooms[userContext.currentRoom]) {
    delete rooms[userContext.currentRoom][userContext.id];
    
    // Notify room members
    userContext.socket.to(userContext.currentRoom).emit('user-disconnected', userContext.id);
    
    // Log remaining users in the room
    const remainingUsers = Object.keys(rooms[userContext.currentRoom]).length;
    console.log(`[SOCKET] Room ${userContext.currentRoom} now has ${remainingUsers} users`);
  }
}