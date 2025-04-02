// Path: services\socket\handlers\polygon-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser } from '@/types/socket.js';
import { db } from '@/config/database.js';
import { CreateFeatureDTO } from '@/types/feature.types.js';
import { compressFeature } from '../../../utils/geometryCompression.js';

/**
 * Validate polygon geometry
 * Ensures polygon coordinates are in proper format and bounds
 */
function isValidPolygon(coordinates: Array<Array<[number, number]>>): { valid: boolean; message?: string } {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return { valid: false, message: "Coordinates must be a non-empty array" };
  }
  
  // Check each ring
  for (const ring of coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) {
      return { valid: false, message: "Each polygon ring must have at least 4 points" };
    }
    
    // Check each coordinate
    for (const coord of ring) {
      if (!Array.isArray(coord) || coord.length !== 2 || 
          typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
        return { valid: false, message: "Each coordinate must be a [longitude, latitude] array of numbers" };
      }
      
      // Validate longitude/latitude ranges
      const [lng, lat] = coord;
      if (lng < -180 || lng > 180) {
        return { valid: false, message: `Invalid longitude: ${lng} (must be between -180 and 180)` };
      }
      if (lat < -90 || lat > 90) {
        return { valid: false, message: `Invalid latitude: ${lat} (must be between -90 and 90)` };
      }
    }
    
    // Check if the ring is closed (first point equals last point)
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return { valid: false, message: "Polygon ring must be closed (first point must equal last point)" };
    }
  }
  
  return { valid: true };
}

/**
 * Validate polygon properties
 */
function validatePolygonProperties(properties: any): { valid: boolean; message?: string; sanitized?: any } {
  const validatedProperties: any = {
    fillColor: '#3388ff',
    borderColor: '#3388ff',
    borderSize: 2,
    borderOpacity: 1,
    fillOpacity: 0.2,
    showArea: false
  };
  
  if (!properties) {
    return { valid: true, sanitized: validatedProperties };
  }
  
  // Validate color formats (hex colors)
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  
  if (properties.fillColor !== undefined) {
    if (typeof properties.fillColor !== 'string' || !colorRegex.test(properties.fillColor)) {
      return { valid: false, message: "fillColor must be a valid hex color (e.g., #3388ff)" };
    }
    validatedProperties.fillColor = properties.fillColor;
  }
  
  if (properties.borderColor !== undefined) {
    if (typeof properties.borderColor !== 'string' || !colorRegex.test(properties.borderColor)) {
      return { valid: false, message: "borderColor must be a valid hex color (e.g., #3388ff)" };
    }
    validatedProperties.borderColor = properties.borderColor;
  }
  
  // Validate numeric properties
  if (properties.borderSize !== undefined) {
    const size = Number(properties.borderSize);
    if (isNaN(size) || size < 0 || size > 10) {
      return { valid: false, message: "borderSize must be a number between 0 and 10" };
    }
    validatedProperties.borderSize = size;
  }
  
  if (properties.borderOpacity !== undefined) {
    const opacity = Number(properties.borderOpacity);
    if (isNaN(opacity) || opacity < 0 || opacity > 1) {
      return { valid: false, message: "borderOpacity must be a number between 0 and 1" };
    }
    validatedProperties.borderOpacity = opacity;
  }
  
  if (properties.fillOpacity !== undefined) {
    const opacity = Number(properties.fillOpacity);
    if (isNaN(opacity) || opacity < 0 || opacity > 1) {
      return { valid: false, message: "fillOpacity must be a number between 0 and 1" };
    }
    validatedProperties.fillOpacity = opacity;
  }
  
  // Validate boolean properties
  if (properties.showArea !== undefined) {
    validatedProperties.showArea = Boolean(properties.showArea);
  }
  
  return { valid: true, sanitized: validatedProperties };
}

/**
 * Set up polygon feature socket handlers
 */
export function setupPolygonHandlers(
  io: SocketIOServer,
  user: SocketUser,
  _rooms: any
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
      const coordValidation = isValidPolygon(data.coordinates);
      if (!coordValidation.valid) {
        socket.emit('error', coordValidation.message || 'Invalid polygon coordinates');
        return;
      }
      
      // Validate properties
      const propsValidation = validatePolygonProperties(data.properties);
      if (!propsValidation.valid) {
        socket.emit('error', propsValidation.message || 'Invalid polygon properties');
        return;
      }
      
      // Create polygon feature with validated/sanitized properties
      // Convert from polygon-specific DTO to the generic CreateFeatureDTO
      const featureData: CreateFeatureDTO = {
        map_id: mapId,
        feature_type: 'polygon',
        geometry: {
          type: 'Polygon',
          coordinates: data.coordinates
        },
        properties: propsValidation.sanitized,
        user_id: user.id,
        user_name: user.name
      };
      
      // Save to database
      const newFeature = await db.createFeature(featureData);
      
      // Record in history
      await db.recordFeatureCreation(newFeature, user.id, user.name);
      
      console.log(`[SOCKET] Polygon feature created with ID ${newFeature.id}`);
      
      // Apply geometry compression before sending
      const compressedFeature = compressFeature(newFeature);
      
      // Broadcast to all clients in the room
      io.to(user.currentRoom).emit('feature-created', {
        feature: compressedFeature,
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
      
      // Validate feature ID
      if (!featureId || typeof featureId !== 'string' || featureId.trim() === '') {
        socket.emit('error', 'Invalid feature ID');
        return;
      }
      
      // Validate version
      if (version === undefined || typeof version !== 'number' || version < 0) {
        socket.emit('error', 'Version is required and must be a non-negative number');
        return;
      }
      
      // Validate coordinates
      const coordValidation = isValidPolygon(coordinates);
      if (!coordValidation.valid) {
        socket.emit('error', coordValidation.message || 'Invalid polygon coordinates');
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
      
      // Apply geometry compression
      const feature = updateResult.feature;
      if (feature) {
        const compressedFeature = compressFeature(feature);
        
        // Broadcast to room
        io.to(user.currentRoom).emit('feature-updated', {
          feature: compressedFeature,
          updater: {
            id: user.id,
            name: user.name
          }
        });
      }
      
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
      
      // Validate feature ID
      if (!featureId || typeof featureId !== 'string' || featureId.trim() === '') {
        socket.emit('error', 'Invalid feature ID');
        return;
      }
      
      // Validate version
      if (version === undefined || typeof version !== 'number' || version < 0) {
        socket.emit('error', 'Version is required and must be a non-negative number');
        return;
      }
      
      // Validate properties
      const propsValidation = validatePolygonProperties(properties);
      if (!propsValidation.valid) {
        socket.emit('error', propsValidation.message || 'Invalid polygon properties');
        return;
      }
      
      // Update feature
      const updateResult = await db.updateFeature(
        featureId,
        {
          properties: propsValidation.sanitized,
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
      
      // Apply geometry compression
      const feature = updateResult.feature;
      if (feature) {
        const compressedFeature = compressFeature(feature);
        
        // Broadcast to room
        io.to(user.currentRoom).emit('feature-updated', {
          feature: compressedFeature,
          updater: {
            id: user.id,
            name: user.name
          }
        });
      }
      
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
    
    // Validate drag info
    if (!dragInfo || typeof dragInfo !== 'object') {
      socket.emit('error', 'Invalid drag information');
      return;
    }
    
    if (!dragInfo.featureId || typeof dragInfo.featureId !== 'string') {
      socket.emit('error', 'Invalid feature ID');
      return;
    }
    
    if (!dragInfo.offset || typeof dragInfo.offset !== 'object' ||
        typeof dragInfo.offset.lng !== 'number' || typeof dragInfo.offset.lat !== 'number') {
      socket.emit('error', 'Invalid offset coordinates');
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
      
      // Validate feature ID
      if (!featureId || typeof featureId !== 'string' || featureId.trim() === '') {
        socket.emit('error', 'Invalid feature ID');
        return;
      }
      
      // Validate version
      if (version === undefined || typeof version !== 'number' || version < 0) {
        socket.emit('error', 'Version is required and must be a non-negative number');
        return;
      }
      
      // Validate coordinates
      const coordValidation = isValidPolygon(newCoordinates);
      if (!coordValidation.valid) {
        socket.emit('error', coordValidation.message || 'Invalid polygon coordinates');
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
      
      // Apply geometry compression
      const feature = updateResult.feature;
      if (feature) {
        const compressedFeature = compressFeature(feature);
        
        // Broadcast to room
        io.to(user.currentRoom).emit('feature-updated', {
          feature: compressedFeature,
          updater: {
            id: user.id,
            name: user.name
          }
        });
      }
      
    } catch (error) {
      console.error('[SOCKET] Error completing polygon drag:', error);
      socket.emit('error', 'Failed to update polygon position');
    }
  });
}