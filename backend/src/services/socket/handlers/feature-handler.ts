// Path: services\socket\handlers\feature-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser } from '@/types/socket.js';
import { db } from '@/config/database.js';
import { Feature } from '@/types/feature.types.js';
import { compressFeatures, compressFeature } from '../../../utils/geometryCompression.js';

/**
 * Validate viewport bounds
 */
function validateBounds(bounds: any): { valid: boolean; message?: string } {
  if (!bounds || typeof bounds !== 'object') {
    return { valid: false, message: 'Invalid bounds object' };
  }
  
  const { minLng, minLat, maxLng, maxLat } = bounds;
  
  // Check all required properties exist and are numbers
  if (minLng === undefined || typeof minLng !== 'number' ||
      minLat === undefined || typeof minLat !== 'number' ||
      maxLng === undefined || typeof maxLng !== 'number' ||
      maxLat === undefined || typeof maxLat !== 'number') {
    return { valid: false, message: 'Bounds must include minLng, minLat, maxLng, maxLat as numbers' };
  }
  
  // Validate coordinate ranges
  if (minLng < -180 || minLng > 180 || maxLng < -180 || maxLng > 180) {
    return { valid: false, message: 'Longitude values must be between -180 and 180' };
  }
  
  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
    return { valid: false, message: 'Latitude values must be between -90 and 90' };
  }
  
  // Ensure min is less than max
  if (minLng > maxLng) {
    return { valid: false, message: 'minLng must be less than or equal to maxLng' };
  }
  
  if (minLat > maxLat) {
    return { valid: false, message: 'minLat must be less than or equal to maxLat' };
  }
  
  return { valid: true };
}

/**
 * Set up feature socket handlers with spatial loading and batch operations
 */
export function setupFeatureHandlers(
  io: SocketIOServer,
  user: SocketUser,
  _rooms: any
): void {
  const { socket } = user;
  
  // Track the features that have already been sent to this client
  // to avoid sending duplicates during viewport movements
  const clientCache = new Map<string, Set<string>>();
  
  // Get the cache for the current user/map
  const getCache = (): Set<string> => {
    if (!user.currentRoom) return new Set<string>();
    
    const cacheKey = `${user.id}:${user.currentRoom}`;
    if (!clientCache.has(cacheKey)) {
      clientCache.set(cacheKey, new Set<string>());
    }
    return clientCache.get(cacheKey)!;
  };
  
  // Get features for current map - used for initial loading or small maps
  socket.on('get-features', async () => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} requesting all features for map ${mapId}`);
      
      // Check map size first to determine loading strategy
      const featureCount = await getMapFeatureCount(mapId);
      
      // For small maps (e.g., less than 500 features), send all at once
      if (featureCount < 500) {
        const features = await db.getMapFeatures(mapId);
        console.log(`[SOCKET] Returning all ${features.length} features for map ${mapId}`);
        
        // Clear and update cache
        const cache = getCache();
        cache.clear();
        features.forEach(f => cache.add(f.id));
        
        // Apply geometry compression to reduce bandwidth
        const compressedFeatures = compressFeatures(features);
        
        socket.emit('features-loaded', compressedFeatures);
      } else {
        // For larger maps, advise the client to use viewport-based loading
        console.log(`[SOCKET] Map ${mapId} has ${featureCount} features, using viewport loading`);
        socket.emit('use-viewport-loading', { featureCount });
      }
      
    } catch (error) {
      console.error('[SOCKET] Error getting features:', error);
      socket.emit('error', 'Failed to load features');
    }
  });
  
  // Get features by type (directly load all features of a specific type)
  socket.on('get-features-by-type', async (featureType) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Validate feature type
      if (!featureType || typeof featureType !== 'string' ||
          !['point', 'line', 'polygon', 'text', 'image'].includes(featureType)) {
        socket.emit('error', 'Invalid feature type');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} requesting ${featureType} features for map ${mapId}`);
      
      const features = await db.getMapFeaturesByType(mapId, featureType);
      console.log(`[SOCKET] Returning ${features.length} ${featureType} features for map ${mapId}`);
      
      // Add to cache
      const cache = getCache();
      features.forEach(f => cache.add(f.id));
      
      // Apply geometry compression to reduce bandwidth
      const compressedFeatures = compressFeatures(features);
      
      socket.emit('features-by-type-loaded', {
        featureType,
        features: compressedFeatures
      });
      
    } catch (error) {
      console.error(`[SOCKET] Error getting ${featureType} features:`, error);
      socket.emit('error', `Failed to load ${featureType} features`);
    }
  });
  
  // Get features in viewport bounds - spatial chunking
  socket.on('get-features-in-bounds', async (bounds) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Validate bounds
      const validation = validateBounds(bounds);
      if (!validation.valid) {
        socket.emit('error', validation.message);
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      const { minLng, minLat, maxLng, maxLat } = bounds;
      
      console.log(
        `[SOCKET] User ${user.id} requesting features in viewport for map ${mapId}: ` +
        `[${minLng.toFixed(4)}, ${minLat.toFixed(4)}, ${maxLng.toFixed(4)}, ${maxLat.toFixed(4)}]`
      );
      
      // Get features in bounds
      const features = await db.getFeaturesInBounds(mapId, minLng, minLat, maxLng, maxLat);
      
      // Filter out features that have already been sent to this client
      const cache = getCache();
      const newFeatures = features.filter(f => !cache.has(f.id));
      
      // Update cache with the new features
      newFeatures.forEach(f => cache.add(f.id));
      
      console.log(
        `[SOCKET] Found ${features.length} features in viewport for map ${mapId}, ` +
        `sending ${newFeatures.length} new features (${cache.size} total in client cache)`
      );
      
      // Apply geometry compression to reduce bandwidth
      const compressedFeatures = compressFeatures(newFeatures);
      
      // Send only new features to the client
      socket.emit('features-in-bounds-loaded', {
        features: compressedFeatures,
        total: {
          inViewport: features.length,
          newFeatures: newFeatures.length,
          cached: cache.size
        }
      });
      
    } catch (error) {
      console.error('[SOCKET] Error getting features in bounds:', error);
      socket.emit('error', 'Failed to load features in bounds');
    }
  });
  
  // Reset feature cache (useful when map view changes dramatically)
  socket.on('reset-feature-cache', () => {
    if (!user.currentRoom) {
      socket.emit('error', 'You must join a map first');
      return;
    }
    
    console.log(`[SOCKET] Resetting feature cache for user ${user.id} in room ${user.currentRoom}`);
    
    const cache = getCache();
    const previousSize = cache.size;
    cache.clear();
    
    socket.emit('feature-cache-reset', { previousSize });
  });
  
  // Process batch operations for features (for offline sync)
  socket.on('batch-feature-operations', async (operations) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }

      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} submitting batch operations for map ${mapId}`);
      
      if (!Array.isArray(operations) || operations.length === 0) {
        socket.emit('error', 'Invalid batch operations');
        return;
      }

      console.log(`[SOCKET] Processing ${operations.length} batch operations`);
      
      // Process operations in order
      const results = [];
      const broadcasts = [];
      
      for (const op of operations) {
        try {
          if (!op.id || !op.type || !op.data || !op.timestamp) {
            results.push({
              success: false,
              operationId: op.id,
              error: 'Invalid operation format'
            });
            continue;
          }
          
          // Ensure the map ID matches the current room
          if (op.data.map_id && op.data.map_id !== mapId) {
            results.push({
              success: false,
              operationId: op.id,
              error: 'Map ID mismatch'
            });
            continue;
          }
          
          // Check if this operation has already been processed (idempotency)
          if (op.id && op.type !== 'get-feature') {
            const existingOperation = await db.getOperationByClientId(op.id);
            if (existingOperation) {
              // Operation already processed, return success without doing anything
              results.push({
                success: true,
                operationId: op.id,
                message: 'Operation already processed',
                idempotent: true
              });
              continue;
            }
          }
          
          let result;
          let broadcastEvent;
          let broadcastData;
          
          switch (op.type) {
            case 'create-feature':
              // Add user info
              op.data.user_id = user.id;
              op.data.user_name = user.name;
              
              // Add client identification for offline syncing
              if (!op.data.client_id) {
                op.data.client_id = op.id;
              }
              if (op.offline) {
                op.data.offline_created = true;
              }
              
              // Check if feature with this client_id already exists
              if (op.data.client_id) {
                const existingFeature = await db.getFeatureByClientId(op.data.client_id, mapId);
                if (existingFeature) {
                  // Feature already exists, return it
                  result = {
                    success: true,
                    operationId: op.id,
                    feature: existingFeature,
                    idempotent: true
                  };
                  break;
                }
              }
              
              // Create the feature
              const newFeature = await db.createFeature(op.data);
              
              // Record in history with client operation ID for idempotency
              await db.recordFeatureCreation(newFeature, user.id, user.name, op.id);
              
              result = {
                success: true,
                operationId: op.id,
                feature: newFeature
              };
              
              // Prepare broadcast
              broadcastEvent = 'feature-created';
              broadcastData = {
                feature: compressFeature(newFeature),
                creator: {
                  id: user.id,
                  name: user.name
                },
                timestamp: op.timestamp
              };
              break;
              
            case 'update-feature':
              // Add user info
              const updateResult = await db.updateFeature(
                op.data.id,
                {
                  geometry: op.data.geometry,
                  properties: op.data.properties,
                  version: op.data.version
                },
                user.id,
                user.name
              );
              
              if (!updateResult.success) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Update failed',
                  currentVersion: updateResult.currentVersion
                };
              } else {
                // Record in history with client operation ID for idempotency
                if (op.data.previousState) {
                  await db.recordFeatureUpdate(
                    op.data.previousState,
                    updateResult.feature!,
                    user.id,
                    user.name,
                    op.id
                  );
                }
                
                result = {
                  success: true,
                  operationId: op.id,
                  feature: updateResult.feature
                };
                
                // Prepare broadcast
                broadcastEvent = 'feature-updated';
                broadcastData = {
                  feature: compressFeature(updateResult.feature!),
                  updater: {
                    id: user.id,
                    name: user.name
                  },
                  timestamp: op.timestamp
                };
              }
              break;
              
            case 'delete-feature':
              // Get feature before deletion for history
              const featureToDelete = await db.getFeature(op.data.id);
              
              if (!featureToDelete) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Feature not found'
                };
              } else {
                // Record history with client operation ID for idempotency
                await db.recordFeatureDeletion(featureToDelete, user.id, user.name, op.id);
                
                // Delete the feature
                const deleted = await db.deleteFeature(op.data.id);
                
                if (!deleted) {
                  result = {
                    success: false,
                    operationId: op.id,
                    error: 'Deletion failed'
                  };
                } else {
                  result = {
                    success: true,
                    operationId: op.id,
                    featureId: op.data.id
                  };
                  
                  // Prepare broadcast
                  broadcastEvent = 'feature-deleted';
                  broadcastData = {
                    featureId: op.data.id,
                    featureType: featureToDelete.feature_type,
                    mapId: featureToDelete.map_id,
                    deleter: {
                      id: user.id,
                      name: user.name
                    },
                    timestamp: op.timestamp
                  };
                }
              }
              break;
              
            case 'get-feature':
              // Special operation type to get a feature by ID
              const feature = await db.getFeature(op.data.id);
              
              if (!feature) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Feature not found'
                };
              } else {
                // Check if the feature belongs to this map
                if (feature.map_id !== mapId) {
                  result = {
                    success: false,
                    operationId: op.id,
                    error: 'Feature does not belong to this map'
                  };
                } else {
                  result = {
                    success: true,
                    operationId: op.id,
                    feature: compressFeature(feature)
                  };
                }
              }
              break;
              
            default:
              result = {
                success: false,
                operationId: op.id,
                error: `Unknown operation type: ${op.type}`
              };
          }
          
          results.push(result);
          
          if (broadcastEvent && broadcastData) {
            broadcasts.push({ event: broadcastEvent, data: broadcastData });
          }
          
        } catch (error) {
          console.error(`[SOCKET] Error processing operation ${op.id}:`, error);
          results.push({
            success: false,
            operationId: op.id,
            error: 'Internal server error'
          });
        }
      }
      
      // Send results back to client
      socket.emit('batch-operation-results', {
        results,
        timestamp: Date.now()
      });
      
      // Broadcast changes to all users in the room
      for (const broadcast of broadcasts) {
        io.to(user.currentRoom).emit(broadcast.event, broadcast.data);
      }
      
      console.log(`[SOCKET] Completed batch operations processing: ${results.filter(r => r.success).length} succeeded, ${results.filter(r => !r.success).length} failed`);
      
    } catch (error) {
      console.error('[SOCKET] Error processing batch operations:', error);
      socket.emit('error', 'Failed to process batch operations');
    }
  });
  
  // Delete features (works for single or multiple features)
  socket.on('delete-features', async (featureIds) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Validate input: ensure featureIds is an array or a valid ID
      let ids: string[] = [];
      if (Array.isArray(featureIds)) {
        ids = featureIds.filter(id => typeof id === 'string' && id.trim() !== '');
      } else if (typeof featureIds === 'string' && featureIds.trim() !== '') {
        ids = [featureIds];
      }
      
      if (ids.length === 0) {
        socket.emit('error', 'No valid feature IDs provided');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} deleting ${ids.length} feature(s): ${ids.join(', ')}`);
      
      // Get all features before deletion for history
      const features = await Promise.all(
        ids.map(id => db.getFeature(id))
      );
      
      const validFeatures = features.filter(f => f !== null) as Feature[];
      
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
      
      // Remove deleted features from client caches
      const roomId = user.currentRoom;
      
      // For all users in this room
      for (const [cacheKey, cache] of clientCache.entries()) {
        if (cacheKey.includes(`:${roomId}`)) {
          validFeatures.forEach(f => cache.delete(f.id));
        }
      }
      
      // If only one feature was deleted, send feature-deleted event
      if (deleteCount === 1 && validFeatures.length === 1) {
        io.to(user.currentRoom).emit('feature-deleted', {
          featureId: validFeatures[0].id,
          featureType: validFeatures[0].feature_type,
          mapId: validFeatures[0].map_id,
          deleter: {
            id: user.id,
            name: user.name
          },
          timestamp: Date.now()
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
          },
          timestamp: Date.now()
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
      
      // Validate feature ID
      if (!featureId || typeof featureId !== 'string' || featureId.trim() === '') {
        socket.emit('error', 'Invalid feature ID');
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
      
      // Validate limit if provided
      if (limit !== undefined && (typeof limit !== 'number' || limit <= 0)) {
        socket.emit('error', 'Invalid limit value');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} requesting history for map ${mapId}${limit ? ` (limit: ${limit})` : ''}`);
      
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
  
  // Clean up when user disconnects
  socket.on('disconnect', () => {
    // Remove all caches for this user
    for (const cacheKey of clientCache.keys()) {
      if (cacheKey.startsWith(`${user.id}:`)) {
        clientCache.delete(cacheKey);
      }
    }
  });
}

/**
 * Get total feature count for a map
 */
async function getMapFeatureCount(mapId: number): Promise<number> {
  try {
    const result = await db.one(
      'SELECT COUNT(*) as count FROM features WHERE map_id = $1',
      [mapId]
    );
    return parseInt(result.count);
  } catch (error) {
    console.error('[DB] Error getting feature count:', error);
    return 0;
  }
}