// Path: config\database.ts
import pgPromise from 'pg-promise';
import config from './env.js';
import { IDB } from '../types/db/index.js';

// Initialization options for pg-promise
const pgpOptions = {
  // Capitalization of SQL queries
  capSQL: true,
  
  // Error handling
  error: (error: any, e: any) => {
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
};

// Initialize pg-promise with options
const pgp = pgPromise(pgpOptions);

console.log('[DB] Attempting to connect to database...');
console.log(`[DB] Connection details: ${config.database.host}:${config.database.port}/${config.database.name}`);
console.log(`[DB] Pool configuration: max=${config.database.pool.max}, min=${config.database.pool.min}, idleTimeout=${config.database.pool.idleTimeoutMillis}ms`);

// Connection parameters
const connectionParams = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  // Pool configuration
  max: config.database.pool.max,              // Maximum number of connections
  min: config.database.pool.min,              // Minimum number of connections to maintain
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis, // Connection timeout for idle connections
  allowExitOnIdle: false,                     // Don't exit application when all clients disconnect
  application_name: 'collaborative-map-backend', // Application name for monitoring
};

// Create the database instance
const db = pgp(connectionParams) as IDB;

// Setup monitoring and logging for the connection pool
if (config.nodeEnv !== 'production') {
  const logConnectionActivity = () => {
    // In non-production environments, periodically log connection pool status
    const stats = (db.$pool as any)?.pool?.totalCount !== undefined ? 
      (db.$pool as any).pool : { totalCount: 0, idleCount: 0, waitingCount: 0 };
      
    console.log(`[DB] Connection pool status: total=${stats.totalCount}, idle=${stats.idleCount}, waiting=${stats.waitingCount}`);
  };
  
  // Log every 5 minutes in development
  setInterval(logConnectionActivity, 5 * 60 * 1000);
}

export { db };