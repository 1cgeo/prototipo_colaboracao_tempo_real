// config/database.init.ts

import { db } from './database.js';
import { FeaturesRepository } from '../db/repos/features.repo.js';
import { FeatureHistoryRepository } from '../db/repos/feature-history.repo.js';
import { MapsRepository } from '../db/repos/maps.repo.js';
import { CommentsRepository } from '../db/repos/comments.repo.js';
import { RepliesRepository } from '../db/repos/replies.repo.js';

/**
 * Initialize database tables and setup repositories
 */
export const initDatabase = async (): Promise<void> => {
  try {
    console.log('[DB] Starting database initialization...');
    
    // Initialize base tables
    await initBaseDb();
    
    // Initialize feature-related tables
    await initFeatureDb();
    
    // Initialize repositories
    initRepositories();
    
    console.log('[DB] Database initialization completed successfully');
  } catch (error) {
    console.error('[DB] Database initialization error:', error);
    throw error;
  }
};

/**
 * Initialize base database tables
 */
const initBaseDb = async (): Promise<void> => {
  await db.tx('init-base-db', async t => {
    console.log('[DB] Creating maps table...');
    await t.none(`
      CREATE TABLE IF NOT EXISTS maps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('[DB] Creating comments table...');
    await t.none(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('[DB] Creating replies table...');
    await t.none(`
      CREATE TABLE IF NOT EXISTS replies (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('[DB] Creating base indexes...');
    await t.none(`
      CREATE INDEX IF NOT EXISTS comments_map_id_idx ON comments(map_id);
      CREATE INDEX IF NOT EXISTS replies_comment_id_idx ON replies(comment_id);
    `);
    
    return null;
  });
};

/**
 * Initialize feature-related tables
 */
const initFeatureDb = async (): Promise<void> => {
  await db.tx('init-feature-db', async t => {
    // Enable PostGIS if not already enabled
    console.log('[DB] Enabling PostGIS extension...');
    await t.none(`CREATE EXTENSION IF NOT EXISTS postgis`);
    
    // Create features table (partition-ready but not partitioned)
    console.log('[DB] Creating features table...');
    await t.none(`
      CREATE TABLE IF NOT EXISTS features (
        id SERIAL PRIMARY KEY,
        map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        feature_type VARCHAR(10) NOT NULL CHECK (feature_type IN ('point', 'line', 'polygon', 'text', 'image')),
        geometry GEOMETRY NOT NULL,
        properties JSONB NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 1
      )
    `);
    
    // Create feature history table
    console.log('[DB] Creating feature_history table...');
    await t.none(`
      CREATE TABLE IF NOT EXISTS feature_history (
        id SERIAL PRIMARY KEY,
        feature_id INTEGER REFERENCES features(id) ON DELETE SET NULL,
        map_id INTEGER NOT NULL,
        operation VARCHAR(10) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        previous_state JSONB NULL,
        new_state JSONB NULL,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for partition readiness
    console.log('[DB] Creating feature indexes...');
    await t.none(`
      CREATE INDEX IF NOT EXISTS features_map_id_idx ON features(map_id);
      CREATE INDEX IF NOT EXISTS features_feature_type_idx ON features(feature_type);
      CREATE INDEX IF NOT EXISTS feature_history_feature_id_idx ON feature_history(feature_id);
      CREATE INDEX IF NOT EXISTS feature_history_map_id_idx ON feature_history(map_id);
    `);
    
    // Create spatial index for geometry
    console.log('[DB] Creating spatial index...');
    await t.none(`
      CREATE INDEX IF NOT EXISTS features_geom_idx ON features USING GIST (geometry);
    `);
    
    return null;
  });
};

/**
 * Initialize all repositories
 */
const initRepositories = (): void => {
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
    getFeature: (id: number) => featuresRepo.getFeature(id),
    createFeature: (data: any) => featuresRepo.createFeature(data),
    updateFeature: (id: number, data: any, userId: string, userName: string) => 
      featuresRepo.updateFeature(id, data, userId, userName),
    deleteFeature: (id: number) => featuresRepo.deleteFeature(id),
    bulkDeleteFeatures: (ids: number[]) => featuresRepo.bulkDeleteFeatures(ids),
    getFeaturesInBounds: (mapId: number, minLng: number, minLat: number, maxLng: number, maxLat: number) => 
      featuresRepo.getFeaturesInBounds(mapId, minLng, minLat, maxLng, maxLat),
    
    // Feature history methods
    recordFeatureCreation: (feature: any, userId: string, userName: string) => 
      featureHistoryRepo.recordCreation(feature, userId, userName),
    recordFeatureUpdate: (previousState: any, newState: any, userId: string, userName: string) => 
      featureHistoryRepo.recordUpdate(previousState, newState, userId, userName),
    recordFeatureDeletion: (feature: any, userId: string, userName: string) => 
      featureHistoryRepo.recordDeletion(feature, userId, userName),
    getFeatureHistory: (featureId: number) => featureHistoryRepo.getFeatureHistory(featureId),
    getMapHistory: (mapId: number, limit?: number) => featureHistoryRepo.getMapHistory(mapId, limit),
    
    // Comments methods
    getMapComments: (mapId: number) => commentsRepo.getMapComments(mapId),
    getCommentReplies: (commentId: number) => commentsRepo.getCommentReplies(commentId),
    createComment: (data: any) => commentsRepo.createComment(data),
    getComment: (id: number) => commentsRepo.getComment(id),
    updateComment: (id: number, content: string) => commentsRepo.updateComment(id, content),
    updateCommentPosition: (id: number, lng: number, lat: number) => commentsRepo.updateCommentPosition(id, lng, lat),
    deleteComment: (id: number) => commentsRepo.deleteComment(id),
    
    // Replies methods
    createReply: (data: any) => repliesRepo.createReply(data),
    getReply: (id: number) => repliesRepo.getReply(id),
    updateReply: (id: number, content: string) => repliesRepo.updateReply(id, content),
    deleteReply: (id: number) => repliesRepo.deleteReply(id),
    getCommentMapId: (commentId: number) => repliesRepo.getCommentMapId(commentId),
  });
  
  console.log('[DB] Repositories initialized');
};