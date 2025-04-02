// Path: config\schema.init.ts

import { db } from './database.js';

/**
 * Initialize database schema with required tables and extensions
 * Using UUIDs for primary keys to support offline-first operations
 */
export const initDatabaseSchema = async (): Promise<void> => {
  try {
    console.log('[DB] Starting database schema initialization...');
    
    // Initialize base tables
    await initBaseDb();
    
    // Initialize feature-related tables
    await initFeatureDb();
    
    console.log('[DB] Database schema initialization completed successfully');
  } catch (error) {
    console.error('[DB] Database schema initialization error:', error);
    throw error;
  }
};

/**
 * Initialize base database tables
 */
const initBaseDb = async (): Promise<void> => {
  await db.tx('init-base-db', async t => {
    // Enable UUID extension
    console.log('[DB] Enabling UUID-OSSP extension...');
    await t.none(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
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
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        client_id VARCHAR(255),
        offline_created BOOLEAN DEFAULT FALSE
      )
    `);

    console.log('[DB] Creating replies table...');
    await t.none(`
      CREATE TABLE IF NOT EXISTS replies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        client_id VARCHAR(255),
        offline_created BOOLEAN DEFAULT FALSE
      )
    `);

    console.log('[DB] Creating base indexes...');
    await t.none(`
      CREATE INDEX IF NOT EXISTS comments_map_id_idx ON comments(map_id);
      CREATE INDEX IF NOT EXISTS replies_comment_id_idx ON replies(comment_id);
      CREATE INDEX IF NOT EXISTS comments_client_id_idx ON comments(client_id) WHERE client_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS replies_client_id_idx ON replies(client_id) WHERE client_id IS NOT NULL;
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
    
    // Create features table with UUID primary key
    console.log('[DB] Creating features table...');
    await t.none(`
      CREATE TABLE IF NOT EXISTS features (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        feature_type VARCHAR(10) NOT NULL CHECK (feature_type IN ('point', 'line', 'polygon', 'text', 'image')),
        geometry GEOMETRY NOT NULL,
        properties JSONB NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 1,
        client_id VARCHAR(255),
        offline_created BOOLEAN DEFAULT FALSE
      )
    `);
    
    // Create feature history table
    console.log('[DB] Creating feature_history table...');
    await t.none(`
      CREATE TABLE IF NOT EXISTS feature_history (
        id SERIAL PRIMARY KEY,
        feature_id UUID REFERENCES features(id) ON DELETE SET NULL,
        map_id INTEGER NOT NULL,
        operation VARCHAR(10) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        previous_state JSONB NULL,
        new_state JSONB NULL,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        client_operation_id VARCHAR(255)
      )
    `);
    
    // Create indexes
    console.log('[DB] Creating feature indexes...');
    await t.none(`
      CREATE INDEX IF NOT EXISTS features_map_id_idx ON features(map_id);
      CREATE INDEX IF NOT EXISTS features_feature_type_idx ON features(feature_type);
      CREATE INDEX IF NOT EXISTS feature_history_feature_id_idx ON feature_history(feature_id);
      CREATE INDEX IF NOT EXISTS feature_history_map_id_idx ON feature_history(map_id);
      CREATE INDEX IF NOT EXISTS features_client_id_idx ON features(client_id) WHERE client_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS feature_history_client_operation_id_idx ON feature_history(client_operation_id) 
        WHERE client_operation_id IS NOT NULL;
    `);
    
    // Create spatial index for geometry
    console.log('[DB] Creating spatial index...');
    await t.none(`
      CREATE INDEX IF NOT EXISTS features_geom_idx ON features USING GIST (geometry);
    `);
    
    return null;
  });
};