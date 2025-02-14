import { io, Socket } from 'socket.io-client';
import { AuthConfig } from '../types/auth';

// Extend Socket type to include auth
export interface ExtendedSocket extends Socket {
  auth: AuthConfig;
}

// Socket Configuration Constants
const SOCKET_CONFIG = {
  path: '/socket.io',
  pingTimeout: 10000,
  pingInterval: 3000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  autoConnect: false
};

// Socket State Management
let socket: ExtendedSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

export const getSocket = (): ExtendedSocket | null => socket;

export const clearSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

// Initialize socket with proper error handling
export const initializeSocket = async (
  baseUrl: string,
  config: AuthConfig
): Promise<ExtendedSocket> => {
  // Clear any existing socket
  clearSocket();

  return new Promise((resolve, reject) => {
    try {
      socket = io(baseUrl, {
        ...SOCKET_CONFIG,
        auth: config
      }) as ExtendedSocket;

      // Store auth for client use
      socket.auth = config;

      // Handle successful connection
      socket.on('connect', () => {
        console.log('Socket connected successfully');
      });

      // Handle connection error
      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        reject(error);
      });

      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (!socket?.connected) {
          const error = new Error('Connection timeout');
          socket?.close();
          reject(error);
        }
      }, SOCKET_CONFIG.pingTimeout);

      // Handle successful auth
      socket.on('user:info', (_data) => {
        clearTimeout(connectionTimeout);
        resolve(socket as ExtendedSocket);
      });

      // Connect socket
      socket.connect();

    } catch (error) {
      console.error('Socket initialization error:', error);
      reject(error);
    }
  });
};