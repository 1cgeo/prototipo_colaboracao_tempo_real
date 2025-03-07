// Path: services\socket\handlers\selection-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser, SelectionState } from '@/types/socket.js';

// Track selections across all maps
const selections: Record<string, SelectionState> = {};

/**
 * Set up feature selection socket handlers
 */
export function setupSelectionHandlers(
  io: SocketIOServer,
  user: SocketUser,
  _rooms: any
): void {
  const { socket } = user;
  
  // Handle feature selection
  socket.on('select-features', (featureIds: number[]) => {
    if (!user.currentRoom) {
      socket.emit('error', 'You must join a map first');
      return;
    }
    
    console.log(`[SOCKET] User ${user.id} selected features: ${featureIds.join(', ')}`);
    
    // Initialize selection state for this room if it doesn't exist
    if (!selections[user.currentRoom]) {
      selections[user.currentRoom] = {};
    }
    
    // Remove user's previous selections
    for (const featureId in selections[user.currentRoom]) {
      if (selections[user.currentRoom][featureId].userId === user.id) {
        delete selections[user.currentRoom][featureId];
      }
    }
    
    // Add new selections
    for (const featureId of featureIds) {
      selections[user.currentRoom][featureId] = {
        userId: user.id,
        userName: user.name,
        featureIds: featureIds
      };
    }
    
    // Broadcast selection to room
    io.to(user.currentRoom).emit('features-selected', {
      userId: user.id,
      userName: user.name,
      featureIds: featureIds
    });
  });
  
  // Handle feature deselection
  socket.on('deselect-features', () => {
    if (!user.currentRoom) {
      return;
    }
    
    console.log(`[SOCKET] User ${user.id} deselected all features`);
    
    // Remove user's selections
    if (selections[user.currentRoom]) {
      for (const featureId in selections[user.currentRoom]) {
        if (selections[user.currentRoom][featureId].userId === user.id) {
          delete selections[user.currentRoom][featureId];
        }
      }
    }
    
    // Broadcast deselection to room
    io.to(user.currentRoom).emit('features-deselected', {
      userId: user.id
    });
  });
  
  // Get current feature selections in the room
  socket.on('get-selections', () => {
    if (!user.currentRoom) {
      socket.emit('error', 'You must join a map first');
      return;
    }
    
    const roomSelections = selections[user.currentRoom] || {};
    const userSelections: Record<string, number[]> = {};
    
    // Group selections by user
    for (const featureId in roomSelections) {
      const selection = roomSelections[featureId];
      
      if (!userSelections[selection.userId]) {
        userSelections[selection.userId] = [];
      }
      
      if (!userSelections[selection.userId].includes(parseInt(featureId))) {
        userSelections[selection.userId].push(parseInt(featureId));
      }
    }
    
    // Send current selections to client
    socket.emit('current-selections', userSelections);
  });
  
  // Clean up selections when user disconnects or leaves room
  socket.on('disconnect', () => {
    // Clean up user's selections in all rooms
    for (const roomId in selections) {
      for (const featureId in selections[roomId]) {
        if (selections[roomId][featureId].userId === user.id) {
          delete selections[roomId][featureId];
        }
      }
    }
  });
}