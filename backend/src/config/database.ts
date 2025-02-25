// src/config/database.ts
import pgPromise from 'pg-promise';
import config from './env.js';
import { initRepositories } from '../db/repos/index.js';
import { IDB } from '../types/db.js';

// Initialize pg-promise with options
const pgp = pgPromise({
  // Initialization options
  capSQL: true, // capitalize SQL
  error: (error, e) => {
    if (e.cn) {
      // Connection-related error
      console.error('DB Connection Error:', error);
    } else if (e.query) {
      // Query-related error
      console.error('DB Query Error:', error);
    } else {
      // Generic DB error
      console.error('DB Error:', error);
    }
  },
});

// Create the database instance
const db = pgp({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
}) as IDB;

// Initialize repositories
initRepositories(db);

// Database initialization function
export const initDb = async (): Promise<void> => {
  try {
    // Create maps table
    await db.none(`
      CREATE TABLE IF NOT EXISTS maps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create comments table
    await db.none(`
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

    // Create replies table
    await db.none(`
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

    // Create indexes
    await db.none(`
      CREATE INDEX IF NOT EXISTS comments_map_id_idx ON comments(map_id);
      CREATE INDEX IF NOT EXISTS replies_comment_id_idx ON replies(comment_id);
    `);

    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

export { db };
