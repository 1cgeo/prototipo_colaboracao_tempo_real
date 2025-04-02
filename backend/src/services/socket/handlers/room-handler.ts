// Path: services\socket\handlers\room-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser, Rooms, UserConnectionState } from '@/types/socket.js';
import { db } from '@/config/database.js';

/**
 * Set up room-related socket handlers with enhanced sync support
 */
export function setupRoomHandlers(
  io: SocketIOServer,
  user: SocketUser,
  rooms: Rooms,
  userConnections: Record<string, UserConnectionState>
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
        leaveCurrentRoom(io, user, rooms);
      }

      // Join new room
      const roomId = `map-${mapId}`;
      socket.join(roomId);
      user.currentRoom = roomId;
      
      // Update user connection state
      if (userConnections[user.id]) {
        userConnections[user.id].lastRoom = roomId;
        if (!userConnections[user.id].lastActivityByMap[mapId]) {
          userConnections[user.id].lastActivityByMap[mapId] = Date.now();
        }
      }
      
      console.log(`[SOCKET] User ${user.id} joined room ${roomId}`);

      // Initialize room if it doesn't exist
      if (!rooms[roomId]) {
        console.log(`[SOCKET] Creating new room ${roomId}`);
        rooms[roomId] = {};
      }

      // Add user to room with name and status
      rooms[roomId][user.id] = {
        id: user.id,
        name: user.name,
        position: { lng: 0, lat: 0 },
        status: 'active',
        joinedAt: Date.now()
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
        status: 'active'
      });
      console.log(`[SOCKET] Notified room ${roomId} that user ${user.name} (${user.id}) joined`);
      
      // Load map features - potentially with sync-based loading
      const syncTimestamp = socket.handshake.auth.lastMapActivity || 0;
      let features;
      
      if (syncTimestamp > 0) {
        // If we have a sync timestamp, only get features updated since then
        console.log(`[SOCKET] User ${user.id} has lastMapActivity timestamp ${new Date(syncTimestamp).toISOString()}`);
        features = await getUpdatedFeaturesSince(mapId, syncTimestamp);
      } else {
        // Otherwise get all features (with smart loading)
        features = await db.getMapFeatures(mapId);
      }
      
      socket.emit('features-loaded', features);
      console.log(`[SOCKET] Sent ${features.length} features to user ${user.id}`);
      
      // Update user's last activity for this map
      if (userConnections[user.id]) {
        userConnections[user.id].lastActivityByMap[mapId] = Date.now();
      }

    } catch (error) {
      console.error('[SOCKET] Error joining map:', error);
      socket.emit('error', 'Failed to join map');
    }
  });

  // Leave current room
  socket.on('leave-map', () => {
    leaveCurrentRoom(io, user, rooms);
  });
  
  // Get updates since a specific timestamp
  socket.on('get-updates-since', async (data: { mapId: number, timestamp: number }) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Verify user is in the correct map
      const roomMapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      if (data.mapId !== roomMapId) {
        socket.emit('error', 'You can only get updates for your current map');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} requesting updates since ${new Date(data.timestamp).toISOString()}`);
      
      // Get features updated since timestamp
      const updatedFeatures = await getUpdatedFeaturesSince(data.mapId, data.timestamp);
      
      // Get comments updated since timestamp
      const updatedComments = await getUpdatedCommentsSince(data.mapId, data.timestamp);
      
      // Get feature history (for deleted items)
      const historyEntries = await getFeatureHistorySince(data.mapId, data.timestamp);
      
      // Extract deleted feature IDs
      const deletedFeatureIds = historyEntries
        .filter(entry => entry.operation === 'delete')
        .map(entry => entry.feature_id)
        .filter(id => id !== null) as number[];
      
      console.log(`[SOCKET] Sending sync update to user ${user.id}:
        - Updated features: ${updatedFeatures.length}
        - Updated comments: ${updatedComments.length}
        - Deleted features: ${deletedFeatureIds.length}`);
      
      // Send all updates in a single message
      socket.emit('sync-updates', {
        timestamp: data.timestamp,
        currentServerTime: Date.now(),
        updates: {
          features: updatedFeatures,
          comments: updatedComments,
          deletedFeatures: deletedFeatureIds
        }
      });
      
      // Update user's last activity for this map
      if (userConnections[user.id]) {
        userConnections[user.id].lastActivityByMap[data.mapId] = Date.now();
      }
      
    } catch (error) {
      console.error('[SOCKET] Error getting updates:', error);
      socket.emit('error', 'Failed to get updates');
    }
  });
  
  // Heartbeat to update the user's last activity time
  socket.on('map-heartbeat', (mapId: number) => {
    if (userConnections[user.id]) {
      userConnections[user.id].lastActivityByMap[mapId] = Date.now();
      userConnections[user.id].lastSeen = Date.now();
    }
  });
}

/**
 * Helper function to leave the current room
 */
function leaveCurrentRoom(_io: SocketIOServer, user: SocketUser, rooms: Rooms): void {
  if (!user.currentRoom) return;
  
  console.log(`[SOCKET] User ${user.id} leaving room ${user.currentRoom}`);
  user.socket.leave(user.currentRoom);
  
  if (rooms[user.currentRoom] && rooms[user.currentRoom][user.id]) {
    delete rooms[user.currentRoom][user.id];
    user.socket.to(user.currentRoom).emit('user-disconnected', user.id);
    console.log(`[SOCKET] Notified room ${user.currentRoom} that user ${user.id} disconnected`);
  }
  
  user.currentRoom = null;
}

/**
 * Get features updated since a specific timestamp
 */
async function getUpdatedFeaturesSince(mapId: number, timestamp: number) {
  try {
    // Use a DB query to get features updated since the timestamp
    const features = await db.any(`
      SELECT id, map_id, feature_type, 
      ST_AsGeoJSON(geometry)::json as geometry, 
      properties, user_id, user_name, created_at, updated_at, version
      FROM features 
      WHERE map_id = $1 AND updated_at > to_timestamp($2/1000.0)
      ORDER BY updated_at ASC
    `, [mapId, timestamp]);
    
    return features;
  } catch (error) {
    console.error('[DB] Error getting updated features:', error);
    return [];
  }
}

/**
 * Get comments updated since a specific timestamp
 */
async function getUpdatedCommentsSince(mapId: number, timestamp: number) {
  try {
    // Get updated comments
    const comments = await db.any(`
      SELECT * FROM comments
      WHERE map_id = $1 AND updated_at > to_timestamp($2/1000.0)
      ORDER BY updated_at ASC
    `, [mapId, timestamp]);
    
    // Get replies for these comments
    for (const comment of comments) {
      comment.replies = await db.any(`
        SELECT * FROM replies
        WHERE comment_id = $1 AND updated_at > to_timestamp($2/1000.0)
        ORDER BY created_at ASC
      `, [comment.id, timestamp]);
    }
    
    return comments;
  } catch (error) {
    console.error('[DB] Error getting updated comments:', error);
    return [];
  }
}

/**
 * Get feature history entries since a specific timestamp
 */
async function getFeatureHistorySince(mapId: number, timestamp: number) {
  try {
    const history = await db.any(`
      SELECT * FROM feature_history
      WHERE map_id = $1 AND timestamp > to_timestamp($2/1000.0)
      ORDER BY timestamp ASC
    `, [mapId, timestamp]);
    
    return history;
  } catch (error) {
    console.error('[DB] Error getting feature history:', error);
    return [];
  }
}