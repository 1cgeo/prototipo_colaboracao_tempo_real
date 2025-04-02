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
  
  // Set interval to clean up stale connections (users disconnected > 4 hours)
  // INCREASED to handle long field sessions
  setInterval(() => {
    const now = Date.now();
    const staleTimeout = 4 * 60 * 60 * 1000; // 4 hours
    
    for (const clientId in userConnections) {
      if (now - userConnections[clientId].lastSeen > staleTimeout) {
        console.log(`[SOCKET] Cleaning up stale connection for user ${clientId} (inactive for >4 hours)`);
        
        // Clean up user from all rooms
        if (userConnections[clientId].lastRoom && rooms[userConnections[clientId].lastRoom]) {
          delete rooms[userConnections[clientId].lastRoom][clientId];
          io.to(userConnections[clientId].lastRoom).emit('user-disconnected', clientId);
        }
        
        delete userConnections[clientId];
      }
    }
  }, 30 * 60 * 1000); // Run every 30 minutes
  
  return io;
};

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