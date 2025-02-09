import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateRandomName } from '../utils/nameGenerator.js';
import mapRoutes from './maps.js';

const router = Router();

// Basic authentication middleware that generates anonymous user info
router.use((req, _res, next) => {
  // If user info is not in headers, generate new anonymous user
  if (!req.headers['x-user-id']) {
    req.body.userId = uuidv4();
    req.body.userName = generateRandomName();
  } else {
    req.body.userId = req.headers['x-user-id'];
    req.body.userName = req.headers['x-user-name'] || generateRandomName();
  }
  next();
});

// Health check route
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
router.use('/maps', mapRoutes);

// Error handling for routes that don't exist
router.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

export default router;
