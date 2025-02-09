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
    // Adicionar um transport específico para cursores
    {
      target: 'pino/file',
      options: { destination: join(logsDir, 'cursor.log') },
      level: 'debug',
    },
  ],
});

// Create and export logger
const logger = pino(
  {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  transports,
);

export default logger;
