// Path: config\repositories.init.ts

import { db } from './database.js';
import { FeaturesRepository } from '../db/repos/features.repo.js';
import { FeatureHistoryRepository } from '../db/repos/feature-history.repo.js';
import { MapsRepository } from '../db/repos/maps.repo.js';
import { CommentsRepository } from '../db/repos/comments.repo.js';
import { RepliesRepository } from '../db/repos/replies.repo.js';

/**
 * Initialize repositories and attach them to the database object
 */
export const initRepositories = (): void => {
  console.log('[DB] Initializing repositories...');
  
  // Create repository instances
  const mapsRepo = new MapsRepository(db);
  const featuresRepo = new FeaturesRepository(db);
  const featureHistoryRepo = new FeatureHistoryRepository(db);
  const commentsRepo = new CommentsRepository(db);
  const repliesRepo = new RepliesRepository(db);
  
  // Extend db object with repository methods
  Object.assign(db, {
    // Maps methods
    getMaps: () => mapsRepo.getMaps(),
    getMap: (id: number) => mapsRepo.getMap(id),
    createMap: (name: string, description: string | null) => mapsRepo.createMap(name, description),
    updateMap: (id: number, name: string, description: string | null) => mapsRepo.updateMap(id, name, description),
    deleteMap: (id: number) => mapsRepo.deleteMap(id),
    
    // Feature methods
    getMapFeatures: (mapId: number) => featuresRepo.getMapFeatures(mapId),
    getMapFeaturesByType: (mapId: number, featureType: string) => featuresRepo.getMapFeaturesByType(mapId, featureType),
    getFeature: (id: string) => featuresRepo.getFeature(id),
    getFeatureByClientId: (clientId: string, mapId: number) => featuresRepo.getFeatureByClientId(clientId, mapId),
    createFeature: (data: any) => featuresRepo.createFeature(data),
    updateFeature: (id: string, data: any, userId: string, userName: string) => 
      featuresRepo.updateFeature(id, data, userId, userName),
    deleteFeature: (id: string) => featuresRepo.deleteFeature(id),
    bulkDeleteFeatures: (ids: string[]) => featuresRepo.bulkDeleteFeatures(ids),
    getFeaturesInBounds: (mapId: number, minLng: number, minLat: number, maxLng: number, maxLat: number) => 
      featuresRepo.getFeaturesInBounds(mapId, minLng, minLat, maxLng, maxLat),
    
    // Sync methods for features
    getUpdatedFeatures: (mapId: number, since: number, page: number, limit: number) => 
      featuresRepo.getUpdatedFeatures(mapId, since, page, limit),
    getFeaturesInViewportSince: (mapId: number, minLng: number, minLat: number, maxLng: number, maxLat: number, since: number, page: number, limit: number) => 
      featuresRepo.getFeaturesInViewportSince(mapId, minLng, minLat, maxLng, maxLat, since, page, limit),
    getUpdatedFeaturesCount: (mapId: number, since: number) => 
      featuresRepo.getUpdatedFeaturesCount(mapId, since),
    isFeatureDeleted: (featureId: string) => 
      featuresRepo.isFeatureDeleted(featureId),
    
    // Feature history methods
    recordFeatureCreation: (feature: any, userId: string, userName: string, clientOperationId?: string) => 
      featureHistoryRepo.recordCreation(feature, userId, userName, clientOperationId),
    recordFeatureUpdate: (previousState: any, newState: any, userId: string, userName: string, clientOperationId?: string) => 
      featureHistoryRepo.recordUpdate(previousState, newState, userId, userName, clientOperationId),
    recordFeatureDeletion: (feature: any, userId: string, userName: string, clientOperationId?: string) => 
      featureHistoryRepo.recordDeletion(feature, userId, userName, clientOperationId),
    getFeatureHistory: (featureId: string) => featureHistoryRepo.getFeatureHistory(featureId),
    getMapHistory: (mapId: number, limit?: number) => featureHistoryRepo.getMapHistory(mapId, limit),
    getOperationByClientId: (clientOperationId: string) => featureHistoryRepo.getOperationByClientId(clientOperationId),
    
    // Sync methods for history
    getMapHistorySince: (mapId: number, since: number, page: number, limit: number) => 
      featureHistoryRepo.getMapHistorySince(mapId, since, page, limit),
    getDeletedFeaturesSince: (mapId: number, since: number) => 
      featureHistoryRepo.getDeletedFeaturesSince(mapId, since),
    
    // Comments methods
    getMapComments: (mapId: number) => commentsRepo.getMapComments(mapId),
    getCommentReplies: (commentId: string) => commentsRepo.getCommentReplies(commentId),
    getCommentByClientId: (clientId: string, mapId: number) => commentsRepo.getCommentByClientId(clientId, mapId),
    createComment: (data: any) => commentsRepo.createComment(data),
    getComment: (id: string) => commentsRepo.getComment(id),
    updateComment: (id: string, content: string) => commentsRepo.updateComment(id, content),
    updateCommentPosition: (id: string, lng: number, lat: number) => commentsRepo.updateCommentPosition(id, lng, lat),
    deleteComment: (id: string) => commentsRepo.deleteComment(id),
    
    // Sync methods for comments
    getUpdatedComments: (mapId: number, since: number, page: number, limit: number) => 
      commentsRepo.getUpdatedComments(mapId, since, page, limit),
    getUpdatedCommentsCount: (mapId: number, since: number) => 
      commentsRepo.getUpdatedCommentsCount(mapId, since),
    
    // Replies methods
    createReply: (data: any) => repliesRepo.createReply(data),
    getReply: (id: string) => repliesRepo.getReply(id),
    getReplyByClientId: (clientId: string, commentId: string) => repliesRepo.getReplyByClientId(clientId, commentId),
    updateReply: (id: string, content: string) => repliesRepo.updateReply(id, content),
    deleteReply: (id: string) => repliesRepo.deleteReply(id),
    getCommentMapId: (commentId: string) => repliesRepo.getCommentMapId(commentId),
  });
  
  console.log('[DB] Repositories initialized');
};