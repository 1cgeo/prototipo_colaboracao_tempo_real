// src/services/socket.service.ts
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import config from '../config/env.js';

let io: SocketIOServer;

export const initializeSocketIO = (server: http.Server): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
};
