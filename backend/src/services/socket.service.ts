// Path: services\socket.service.ts
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import config from '../config/env.js';

let io: SocketIOServer;

export const initializeSocketIO = (server: http.Server): SocketIOServer => {
  console.log('[SOCKET] Initializing Socket.IO server...');
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });
  console.log('[SOCKET] Socket.IO server initialized successfully');
  console.log(`[SOCKET] CORS configured for origin: ${config.cors.origin}`);

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    console.error('[SOCKET] Attempted to access Socket.IO before initialization');
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
};