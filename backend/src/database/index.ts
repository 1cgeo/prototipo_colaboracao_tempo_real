import pgPromise, { IInitOptions, IEventContext } from 'pg-promise';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

// Database interface types
interface IExtensions {
  // Define at least one property to avoid empty interface warning
  _tag: 'DatabaseExtensions';
}

// pg-promise initialization options
const initOptions: IInitOptions<IExtensions> = {
  // Event handlers
  error(error: Error, e: any) {
    if (e.cn) {
      // A connection-related error
      logger.error('CN:', e.cn);
      logger.error('EVENT:', error.message || error);
    }
  },
  query(e: any) {
    if (config.nodeEnv === 'development') {
      logger.debug('QUERY:', e.query);
    }
  },
  receive(e: { data: any[]; result: any; ctx: IEventContext<any> }) {
    if (config.nodeEnv === 'development') {
      logger.debug('DATA:', { rows: e.data.length });
    }
  },
};

// Initialize pg-promise with options and extensions
const pgp = pgPromise<IExtensions>(initOptions);

// Database connection configuration
const dbConfig = {
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 30, // Maximum number of connections
};

// Create the database instance
export const db = pgp(dbConfig);

// Test the connection
db.connect()
  .then(obj => {
    logger.info('Database connection successful');
    obj.done(); // Release the connection
  })
  .catch(error => {
    logger.error('Database connection error:', error.message || error);
  });
