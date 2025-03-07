// Path: services\socket\handlers\polygon-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser } from '@/types/socket.js';
import { db } from '@/config/database.js';

/**
 * Validate polygon geometry
 */
function isValidPolygon(coordinates: Array<Array<[number, number]>>): boolean {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return false;
  }
  
  // Check each ring
  for (const ring of coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) {
      // A valid polygon ring must have at least 4 points (to close the ring)
      return false;
    }
    
    // Check each coordinate
    for (const coord of ring) {
      if (!Array.isArray(coord) || coord.length !== 2 || 
          typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
        return false;
      }
      
      // Validate longitude/latitude ranges
      const [lng, lat] = coord;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return false;
      }
    }
    
    // Check if the ring is closed (first point equals last point)
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Set up polygon feature socket handlers
 */
export function setupPolygonHandlers(
  io: SocketIOServer,
  user: SocketUser,
  _rooms: any // Using underscore to mark as intentionally unused parameter
): void {
  const { socket } = user;
  
  // Create polygon feature
  socket.on('create-polygon', async (data) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} creating new polygon on map ${mapId}`);
      
      // Validate coordinates
      if (!data.coordinates || !isValidPolygon(data.coordinates)) {
        socket.emit('error', 'Invalid polygon coordinates');
        return;
      }
      
      // Create polygon feature
      const polygonFeature = {
        map_id: mapId,
        feature_type: 'polygon' as const,
        geometry: {
          type: 'Polygon',
          coordinates: data.coordinates
        },
        properties: {
          fillColor: data.properties?.fillColor || '#3388ff',
          borderColor: data.properties?.borderColor || '#3388ff',
          borderSize: data.properties?.borderSize || 2,
          borderOpacity: data.properties?.borderOpacity || 1,
          fillOpacity: data.properties?.fillOpacity || 0.2,
          showArea: data.properties?.showArea || false
        },
        user_id: user.id,
        user_name: user.name
      };
      
      // Save to database
      const newFeature = await db.createFeature(polygonFeature);
      
      // Record in history
      await db.recordFeatureCreation(newFeature, user.id, user.name);
      
      console.log(`[SOCKET] Polygon feature created with ID ${newFeature.id}`);
      
      // Broadcast to all clients in the room
      io.to(user.currentRoom).emit('feature-created', {
        feature: newFeature,
        creator: {
          id: user.id,
          name: user.name
        }
      });
      
    } catch (error) {
      console.error('[SOCKET] Error creating polygon:', error);
      socket.emit('error', 'Failed to create polygon');
    }
  });
  
  // Update polygon geometry
  socket.on('update-polygon-geometry', async (data) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const { featureId, coordinates, version } = data;
      console.log(`[SOCKET] User ${user.id} updating polygon geometry for feature ${featureId}`);
      
      // Validate version
      if (version === undefined) {
        socket.emit('error', 'Version is required for updates');
        return;
      }
      
      // Validate coordinates
      if (!coordinates || !isValidPolygon(coordinates)) {
        socket.emit('error', 'Invalid polygon coordinates');
        return;
      }
      
      // Update feature
      const updateResult = await db.updateFeature(
        featureId,
        {
          geometry: {
            type: 'Polygon',
            coordinates: coordinates
          },
          version: version
        },
        user.id,
        user.name
      );
      
      if (!updateResult.success) {
        if (updateResult.currentVersion !== undefined) {
          socket.emit('feature-update-conflict', {
            featureId,
            currentVersion: updateResult.currentVersion
          });
        } else {
          socket.emit('error', 'Failed to update polygon geometry');
        }
        return;
      }
      
      console.log(`[SOCKET] Polygon geometry updated successfully for feature ${featureId}`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('feature-updated', {
        feature: updateResult.feature,
        updater: {
          id: user.id,
          name: user.name
        }
      });
      
    } catch (error) {
      console.error('[SOCKET] Error updating polygon geometry:', error);
      socket.emit('error', 'Failed to update polygon geometry');
    }
  });
  
  // Update polygon properties
  socket.on('update-polygon-properties', async (data) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const { featureId, properties, version } = data;
      console.log(`[SOCKET] User ${user.id} updating polygon properties for feature ${featureId}`);
      
      // Validate version
      if (version === undefined) {
        socket.emit('error', 'Version is required for updates');
        return;
      }
      
      // Validate properties
      if (!properties) {
        socket.emit('error', 'Properties are required');
        return;
      }
      
      // Update feature
      const updateResult = await db.updateFeature(
        featureId,
        {
          properties: properties,
          version: version
        },
        user.id,
        user.name
      );
      
      if (!updateResult.success) {
        if (updateResult.currentVersion !== undefined) {
          socket.emit('feature-update-conflict', {
            featureId,
            currentVersion: updateResult.currentVersion
          });
        } else {
          socket.emit('error', 'Failed to update polygon properties');
        }
        return;
      }
      
      console.log(`[SOCKET] Polygon properties updated successfully for feature ${featureId}`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('feature-updated', {
        feature: updateResult.feature,
        updater: {
          id: user.id,
          name: user.name
        }
      });
      
    } catch (error) {
      console.error('[SOCKET] Error updating polygon properties:', error);
      socket.emit('error', 'Failed to update polygon properties');
    }
  });
  
  // Drag polygon
  socket.on('drag-polygon', (dragInfo) => {
    if (!user.currentRoom) {
      return;
    }
    
    // Broadcast drag event to room
    socket.to(user.currentRoom).emit('polygon-dragging', {
      featureId: dragInfo.featureId,
      offset: dragInfo.offset,
      dragger: {
        id: user.id,
        name: user.name
      }
    });
  });
  
  // End polygon drag
  socket.on('end-polygon-drag', async (data) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const { featureId, newCoordinates, version } = data;
      console.log(`[SOCKET] User ${user.id} ending polygon drag for feature ${featureId}`);
      
      // Validate version
      if (version === undefined) {
        socket.emit('error', 'Version is required for updates');
        return;
      }
      
      // Validate coordinates
      if (!newCoordinates || !isValidPolygon(newCoordinates)) {
        socket.emit('error', 'Invalid polygon coordinates');
        return;
      }
      
      // Update feature with new position
      const updateResult = await db.updateFeature(
        featureId,
        {
          geometry: {
            type: 'Polygon',
            coordinates: newCoordinates
          },
          version: version
        },
        user.id,
        user.name
      );
      
      if (!updateResult.success) {
        if (updateResult.currentVersion !== undefined) {
          socket.emit('feature-update-conflict', {
            featureId,
            currentVersion: updateResult.currentVersion
          });
        } else {
          socket.emit('error', 'Failed to update polygon position');
        }
        return;
      }
      
      console.log(`[SOCKET] Polygon drag completed for feature ${featureId}`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('feature-updated', {
        feature: updateResult.feature,
        updater: {
          id: user.id,
          name: user.name
        }
      });
      
    } catch (error) {
      console.error('[SOCKET] Error completing polygon drag:', error);
      socket.emit('error', 'Failed to update polygon position');
    }
  });
}