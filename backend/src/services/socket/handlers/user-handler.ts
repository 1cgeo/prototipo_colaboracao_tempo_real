// services/socket/handlers/user-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser, Rooms, Position } from '@/types/socket.js';

/**
 * Set up user-related socket handlers
 */
export function setupUserHandlers(
  io: SocketIOServer,
  user: SocketUser,
  rooms: Rooms
): void {
  const { socket } = user;
  
  // Handle user movement
  socket.on('mousemove', (position: Position) => {
    if (!user.currentRoom || !rooms[user.currentRoom] || !rooms[user.currentRoom][user.id]) {
      return;
    }

    // Update user position in room state
    rooms[user.currentRoom][user.id].position = position;

    // Only log occasionally to avoid flooding the console
    const shouldLog = Math.random() < 0.01; // Log approx. 1% of movements
    if (shouldLog) {
      console.log(`[SOCKET] User ${user.id} moved to position: ${position.lng.toFixed(4)}, ${position.lat.toFixed(4)}`);
    }

    // Broadcast to all clients in the room except sender
    socket.to(user.currentRoom).emit('user-move', {
      id: user.id,
      name: user.name,
      position,
    });
  });
  
  // Handle user name change
  socket.on('change-name', (newName: string) => {
    if (!newName || newName.trim().length === 0) {
      socket.emit('error', 'Invalid name');
      return;
    }
    
    console.log(`[SOCKET] User ${user.id} changing name from "${user.name}" to "${newName}"`);
    user.name = newName;
    
    // Update name in all rooms
    if (user.currentRoom && rooms[user.currentRoom] && rooms[user.currentRoom][user.id]) {
      rooms[user.currentRoom][user.id].name = newName;
      
      // Notify room of name change
      socket.to(user.currentRoom).emit('user-renamed', {
        id: user.id,
        name: newName
      });
      
      // Confirm name change to user
      socket.emit('name-changed', {
        id: user.id,
        name: newName
      });
    }
  });
}