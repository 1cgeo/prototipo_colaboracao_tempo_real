// Path: config\database.init.ts

import { initDatabaseSchema } from './schema.init.js';
import { initRepositories } from './repositories.init.js';

/**
 * Initialize database - both schema and repositories
 */
export const initDatabase = async (): Promise<void> => {
  try {
    console.log('[DB] Starting database initialization...');
    
    // Initialize database schema (tables, indexes, etc.)
    await initDatabaseSchema();
    
    // Initialize repositories
    initRepositories();
    
    console.log('[DB] Database initialization completed successfully');
  } catch (error) {
    console.error('[DB] Database initialization error:', error);
    throw error;
  }
};