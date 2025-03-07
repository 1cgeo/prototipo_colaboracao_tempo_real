// services/socket/handlers/feature-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser, Rooms } from '../../../types/socket.js';
import { db } from '../../../config/database.js';

/**
 * Set up generic feature socket handlers
 */
export function setupFeatureHandlers(
  io: SocketIOServer,
  user: SocketUser,
  rooms: Rooms
): void {
  const { socket } = user;
  
  // Get all features for current map
  socket.on('get-features', async () => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} requesting features for map ${mapId}`);
      
      const features = await db.getMapFeatures(mapId);
      console.log(`[SOCKET] Returning ${features.length} features for map ${mapId}`);
      
      socket.emit('features-loaded', features);
      
    } catch (error) {
      console.error('[SOCKET] Error getting features:', error);
      socket.emit('error', 'Failed to load features');
    }
  });
  
  // Get features by type
  socket.on('get-features-by-type', async (featureType) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} requesting ${featureType} features for map ${mapId}`);
      
      const features = await db.getMapFeaturesByType(mapId, featureType);
      console.log(`[SOCKET] Returning ${features.length} ${featureType} features for map ${mapId}`);
      
      socket.emit('features-by-type-loaded', {
        featureType,
        features
      });
      
    } catch (error) {
      console.error(`[SOCKET] Error getting ${featureType} features:`, error);
      socket.emit('error', `Failed to load ${featureType} features`);
    }
  });
  
  // Get features in bounds
  socket.on('get-features-in-bounds', async (bounds) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} requesting features in bounds for map ${mapId}`);
      
      const { minLng, minLat, maxLng, maxLat } = bounds;
      const features = await db.getFeaturesInBounds(mapId, minLng, minLat, maxLng, maxLat);
      
      console.log(`[SOCKET] Returning ${features.length} features in bounds for map ${mapId}`);
      socket.emit('features-in-bounds-loaded', features);
      
    } catch (error) {
      console.error('[SOCKET] Error getting features in bounds:', error);
      socket.emit('error', 'Failed to load features in bounds');
    }
  });
  
  // Delete feature (generic)
  socket.on('delete-feature', async (featureId: number) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} deleting feature ${featureId}`);
      
      // Get feature before deletion
      const feature = await db.getFeature(featureId);
      
      if (!feature) {
        socket.emit('error', 'Feature not found');
        return;
      }
      
      // Record in history before deleting
      await db.recordFeatureDeletion(feature, user.id, user.name);
      
      // Delete the feature
      const deleted = await db.deleteFeature(featureId);
      
      if (!deleted) {
        socket.emit('error', 'Failed to delete feature');
        return;
      }
      
      console.log(`[SOCKET] Feature ${featureId} deleted successfully`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('feature-deleted', {
        featureId,
        featureType: feature.feature_type,
        mapId: feature.map_id,
        deleter: {
          id: user.id,
          name: user.name
        }
      });
      
    } catch (error) {
      console.error('[SOCKET] Error deleting feature:', error);
      socket.emit('error', 'Failed to delete feature');
    }
  });
  
  // Bulk delete features
  socket.on('delete-features', async (featureIds: number[]) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} bulk deleting ${featureIds.length} features`);
      
      if (featureIds.length === 0) {
        return;
      }
      
      // Get all features before deletion for history
      const features = await Promise.all(
        featureIds.map(id => db.getFeature(id))
      );
      
      const validFeatures = features.filter(f => f !== null);
      
      if (validFeatures.length === 0) {
        socket.emit('error', 'No valid features to delete');
        return;
      }
      
      // Record history for each feature
      for (const feature of validFeatures) {
        await db.recordFeatureDeletion(feature, user.id, user.name);
      }
      
      // Bulk delete features
      const deleteCount = await db.bulkDeleteFeatures(
        validFeatures.map(f => f.id)
      );
      
      console.log(`[SOCKET] Successfully deleted ${deleteCount} features`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('features-deleted', {
        featureIds: validFeatures.map(f => f.id),
        mapId: validFeatures[0].map_id,
        deleteCount,
        deleter: {
          id: user.id,
          name: user.name
        }
      });
      
    } catch (error) {
      console.error('[SOCKET] Error bulk deleting features:', error);
      socket.emit('error', 'Failed to delete features');
    }
  });
  
  // Get feature history
  socket.on('get-feature-history', async (featureId) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} requesting history for feature ${featureId}`);
      
      const history = await db.getFeatureHistory(featureId);
      
      socket.emit('feature-history', {
        featureId,
        history
      });
      
    } catch (error) {
      console.error('[SOCKET] Error getting feature history:', error);
      socket.emit('error', 'Failed to load feature history');
    }
  });
  
  // Get map history
  socket.on('get-map-history', async (limit?: number) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} requesting history for map ${mapId}`);
      
      const history = await db.getMapHistory(mapId, limit);
      
      socket.emit('map-history', {
        mapId,
        history
      });
      
    } catch (error) {
      console.error('[SOCKET] Error getting map history:', error);
      socket.emit('error', 'Failed to load map history');
    }
  });
}