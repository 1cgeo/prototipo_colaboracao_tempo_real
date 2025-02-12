import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/error.js';
import routes from './routes/index.js';
import { setupWebSocket } from './websocket/index.js';

// Initialize express app
const app = express();

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket
setupWebSocket(server);

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: config.security.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// Start server
server.listen(config.port, () => {
  logger.info(
    `Server running on port ${config.port} in ${config.nodeEnv} mode`,
  );
  logger.info(`WebSocket server running at path ${config.ws.path}`);
});

// Handle shutdown
const gracefulShutdown = () => {
  logger.info('Received shutdown signal. Closing server...');
  server.close(() => {
    logger.info('Server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught errors
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default server;
