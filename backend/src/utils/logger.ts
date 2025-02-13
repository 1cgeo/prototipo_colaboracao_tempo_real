import { pino } from 'pino';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Ensure logs directory exists
const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Create transports
const transports = pino.transport({
  targets: [
    {
      target: 'pino/file',
      options: { destination: join(logsDir, 'app.log') },
      level: 'info',
    },
    {
      target: 'pino/file',
      options: { destination: join(logsDir, 'cursor.log') },
      level: 'debug',
    },
    {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  ],
});

// Create and export logger
const logger = pino(
  {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      }
    }
  },
  transports,
);

// Override logger methods to also log to console
const enhancedLogger = {
  info: (msg: string, ...args: any[]) => {
    console.log('[INFO]', msg, ...args);
    logger.info(msg, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    console.error('[ERROR]', msg, ...args);
    logger.error(msg, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn('[WARN]', msg, ...args);
    logger.warn(msg, ...args);
  },
  debug: (msg: string, ...args: any[]) => {
    console.debug('[DEBUG]', msg, ...args);
    logger.debug(msg, ...args);
  }
};

export default enhancedLogger;