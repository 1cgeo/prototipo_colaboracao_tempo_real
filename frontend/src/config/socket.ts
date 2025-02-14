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
  autoConnect: false,
  transports: ['websocket']
};

// Socket State Management
let socket: ExtendedSocket | null = null;
let connecting = false;

export const getSocket = (): ExtendedSocket | null => socket;

// Initialize socket with proper error handling and singleton pattern
export const initializeSocket = async (
  baseUrl: string,
  config: AuthConfig
): Promise<ExtendedSocket> => {
  // Prevent multiple concurrent connection attempts
  if (connecting) {
    throw new Error('Socket connection already in progress');
  }

  // Return existing connected socket if available with same config
  if (socket?.connected && socket.auth.user_id === config.user_id) {
    console.log('[Socket] Reusing existing connected socket');
    return socket;
  }

  // Clear any existing socket
  if (socket) {
    console.log('[Socket] Cleaning up existing socket');
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  connecting = true;

  try {
    // Initialize new socket
    console.log('[Socket] Creating new socket instance');
    socket = io(baseUrl, {
      ...SOCKET_CONFIG,
      auth: config
    }) as ExtendedSocket;
    socket.auth = config;

    // Return promise that resolves when user:info is received
    return new Promise((resolve, reject) => {
      if (!socket) {
        connecting = false;
        reject(new Error('Failed to create socket'));
        return;
      }

      const timeoutId = setTimeout(() => {
        connecting = false;
        if (socket) {
          socket.disconnect();
          socket = null;
        }
        reject(new Error('Connection timeout'));
      }, SOCKET_CONFIG.pingTimeout);

      socket.once('connect', () => {
        console.log('[Socket] Connected successfully');
      });

      socket.once('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        clearTimeout(timeoutId);
        connecting = false;
        if (socket) {
          socket.disconnect();
          socket = null;
        }
        reject(error);
      });

      socket.once('user:info', (data) => {
        console.log('[Socket] User info received:', data);
        clearTimeout(timeoutId);
        connecting = false;
        if (socket) {
          resolve(socket);
        } else {
          reject(new Error('Socket closed unexpectedly'));
        }
      });

      console.log('[Socket] Connecting...');
      socket.connect();
    });
  } catch (error) {
    connecting = false;
    throw error;
  }
};