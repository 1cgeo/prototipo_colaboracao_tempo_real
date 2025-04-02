// Path: config\database.ts
import pgPromise from 'pg-promise';
import config from './env.js';
import { IDB } from '../types/db/index.js';

// Initialize pg-promise with options
const pgp = pgPromise({
  // Initialization options
  capSQL: true, // capitalize SQL
  error: (error, e) => {
    if (e.cn) {
      // Connection-related error
      console.error('[DB] Connection Error:', error);
    } else if (e.query) {
      // Query-related error
      console.error('[DB] Query Error:', error);
      console.error('[DB] Failed Query:', e.query);
      if (e.params) {
        console.error('[DB] Query Parameters:', e.params);
      }
    } else {
      // Generic DB error
      console.error('[DB] Error:', error);
    }
  },
});

console.log('[DB] Attempting to connect to database...');
console.log(`[DB] Connection details: ${config.database.host}:${config.database.port}/${config.database.name}`);

// Create the database instance
const db = pgp({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
}) as IDB;

export { db };