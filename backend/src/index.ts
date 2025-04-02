// Path: index.ts
import express from 'express';
import http from 'http';
import cors from 'cors';
import config from './config/env.js';
import { initializeSocketIO } from './services/socket/index.js';
import { initDatabase } from './config/database.init.js';
import routes from './routes/index.js';

const app = express();
app.use(
  cors({
    origin: config.cors.origin,
  }),
);
app.use(express.json());

// API routes
app.use('/api', routes);

const server = http.createServer(app);

// Initialize socket
initializeSocketIO(server);

// Initialize database
initDatabase()
  .then(() => {
    console.log('[SERVER] Database initialized successfully');
  })
  .catch(err => {
    console.error('[SERVER] Failed to initialize database:', err);
    process.exit(1); // Exit if database initialization fails
  });

const PORT = config.port;
server.listen(PORT, () => {
  console.log(`[SERVER] Server running in ${config.nodeEnv} mode on port ${PORT}`);
  console.log(`[SERVER] CORS origin set to: ${config.cors.origin}`);
});