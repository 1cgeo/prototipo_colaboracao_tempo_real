// services/socket/handlers/room-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser, Rooms } from '@/types/socket.js';
import { db } from '@/config/database.js';

/**
 * Set up room-related socket handlers
 */
export function setupRoomHandlers(
  io: SocketIOServer,
  user: SocketUser,
  rooms: Rooms
): void {
  const { socket } = user;
  
  // Join a specific map room
  socket.on('join-map', async (mapId: number) => {
    try {
      console.log(`[SOCKET] User ${user.id} attempting to join map ${mapId}`);
      
      // Check if map exists
      const map = await db.getMap(mapId);
      if (!map) {
        console.log(`[SOCKET] Map ${mapId} not found, rejecting join request`);
        socket.emit('error', 'Map not found');
        return;
      }

      // Leave previous room if any
      if (user.currentRoom) {
        console.log(`[SOCKET] User ${user.id} leaving previous room ${user.currentRoom}`);
        socket.leave(user.currentRoom);
        
        if (rooms[user.currentRoom] && rooms[user.currentRoom][user.id]) {
          delete rooms[user.currentRoom][user.id];
          socket.to(user.currentRoom).emit('user-disconnected', user.id);
          console.log(`[SOCKET] Notified room ${user.currentRoom} that user ${user.id} disconnected`);
        }
      }

      // Join new room
      const roomId = `map-${mapId}`;
      socket.join(roomId);
      user.currentRoom = roomId;
      console.log(`[SOCKET] User ${user.id} joined room ${roomId}`);

      // Initialize room if it doesn't exist
      if (!rooms[roomId]) {
        console.log(`[SOCKET] Creating new room ${roomId}`);
        rooms[roomId] = {};
      }

      // Add user to room with name
      rooms[roomId][user.id] = {
        id: user.id,
        name: user.name,
        position: { lng: 0, lat: 0 },
      };

      // Send user details back to the client
      socket.emit('user-info', {
        id: user.id,
        name: user.name,
      });
      console.log(`[SOCKET] Sent user info to ${user.id}`);

      // Send all users in the room to the new user
      socket.emit('users', Object.values(rooms[roomId]));
      console.log(`[SOCKET] Sent users list to ${user.id} (${Object.keys(rooms[roomId]).length} users)`);

      // Notify room of new user
      socket.to(roomId).emit('user-joined', {
        id: user.id,
        name: user.name,
        position: { lng: 0, lat: 0 },
      });
      console.log(`[SOCKET] Notified room ${roomId} that user ${user.name} (${user.id}) joined`);
      
      // Load map features
      const features = await db.getMapFeatures(mapId);
      socket.emit('features-loaded', features);
      console.log(`[SOCKET] Sent ${features.length} features to user ${user.id}`);

    } catch (error) {
      console.error('[SOCKET] Error joining map:', error);
      socket.emit('error', 'Failed to join map');
    }
  });

  // Leave current room
  socket.on('leave-map', () => {
    if (!user.currentRoom) return;
    
    console.log(`[SOCKET] User ${user.id} leaving room ${user.currentRoom}`);
    socket.leave(user.currentRoom);
    
    if (rooms[user.currentRoom] && rooms[user.currentRoom][user.id]) {
      delete rooms[user.currentRoom][user.id];
      socket.to(user.currentRoom).emit('user-disconnected', user.id);
      console.log(`[SOCKET] Notified room ${user.currentRoom} that user ${user.id} disconnected`);
    }
    
    user.currentRoom = null;
  });
}