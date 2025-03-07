// Path: services\socket\handlers\feature-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser } from '@/types/socket.js';
import { db } from '@/config/database.js';

/**
 * Set up generic feature socket handlers
 */
export function setupFeatureHandlers(
  io: SocketIOServer,
  user: SocketUser,
  _rooms: any // Using underscore to mark as intentionally unused parameter
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
  
  // Delete features (works for single or multiple features)
  socket.on('delete-features', async (featureIds) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Ensure featureIds is an array
      const ids = Array.isArray(featureIds) ? featureIds : [featureIds];
      
      console.log(`[SOCKET] User ${user.id} deleting ${ids.length} feature(s): ${ids.join(', ')}`);
      
      if (ids.length === 0) {
        return;
      }
      
      // Get all features before deletion for history
      const features = await Promise.all(
        ids.map(id => db.getFeature(id))
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
      
      console.log(`[SOCKET] Successfully deleted ${deleteCount} feature(s)`);
      
      // If only one feature was deleted, send feature-deleted event
      if (deleteCount === 1 && validFeatures.length === 1) {
        io.to(user.currentRoom).emit('feature-deleted', {
          featureId: validFeatures[0].id,
          featureType: validFeatures[0].feature_type,
          mapId: validFeatures[0].map_id,
          deleter: {
            id: user.id,
            name: user.name
          }
        });
      } else {
        // Otherwise, send features-deleted event
        io.to(user.currentRoom).emit('features-deleted', {
          featureIds: validFeatures.map(f => f.id),
          mapId: validFeatures[0].map_id,
          deleteCount,
          deleter: {
            id: user.id,
            name: user.name
          }
        });
      }
      
    } catch (error) {
      console.error('[SOCKET] Error deleting features:', error);
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
  
  // Revert feature to previous state
  socket.on('revert-feature', async (data) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const { featureId, historyId } = data;
      console.log(`[SOCKET] User ${user.id} reverting feature ${featureId} to history state ${historyId}`);
      
      // Get the history entry
      const historyEntries = await db.getFeatureHistory(featureId);
      const historyEntry = historyEntries.find(entry => entry.id === historyId);
      
      if (!historyEntry) {
        socket.emit('error', 'History entry not found');
        return;
      }
      
      // Get the current feature
      const currentFeature = await db.getFeature(featureId);
      
      if (!currentFeature) {
        socket.emit('error', 'Feature not found');
        return;
      }
      
      // Determine the state to revert to
      let revertState;
      
      if (historyEntry.operation === 'create') {
        // Revert to the initial state
        revertState = historyEntry.new_state;
      } else if (historyEntry.operation === 'update') {
        // Revert to the state before the update
        revertState = historyEntry.previous_state;
      } else if (historyEntry.operation === 'delete') {
        // Revert to the state before deletion
        revertState = historyEntry.previous_state;
      } else {
        socket.emit('error', 'Cannot revert to this history state');
        return;
      }
      
      if (!revertState) {
        socket.emit('error', 'No valid state to revert to');
        return;
      }
      
      // Check if the feature was deleted (not present) and needs to be recreated
      if (!currentFeature && revertState) {
        // Need to recreate the feature from history
        const newFeature = await db.createFeature({
          map_id: revertState.map_id,
          feature_type: revertState.feature_type,
          geometry: revertState.geometry,
          properties: revertState.properties,
          user_id: user.id,
          user_name: user.name
        });
        
        // Record the recreation in history
        await db.recordFeatureCreation(newFeature, user.id, user.name);
        
        console.log(`[SOCKET] Feature ${featureId} was recreated from history state ${historyId}`);
        
        // Broadcast the recreation
        io.to(user.currentRoom).emit('feature-created', {
          feature: newFeature,
          creator: {
            id: user.id,
            name: user.name
          },
          revertedFrom: historyId
        });
        
      } else {
        // Feature exists, update it to the previous state
        const updateResult = await db.updateFeature(
          featureId,
          {
            geometry: revertState.geometry,
            properties: revertState.properties,
            version: currentFeature.version
          },
          user.id,
          user.name
        );
        
        if (!updateResult.success) {
          if (updateResult.currentVersion) {
            socket.emit('feature-update-conflict', {
              featureId,
              currentVersion: updateResult.currentVersion
            });
          } else {
            socket.emit('error', 'Failed to revert feature');
          }
          return;
        }
        
        console.log(`[SOCKET] Feature ${featureId} reverted to history state ${historyId}`);
        
        // Broadcast the update
        io.to(user.currentRoom).emit('feature-updated', {
          feature: updateResult.feature,
          updater: {
            id: user.id,
            name: user.name
          },
          revertedFrom: historyId
        });
      }
      
      // Send confirmation to the client
      socket.emit('feature-reverted', {
        featureId,
        historyId
      });
      
    } catch (error) {
      console.error('[SOCKET] Error reverting feature:', error);
      socket.emit('error', 'Failed to revert feature');
    }
  });
}