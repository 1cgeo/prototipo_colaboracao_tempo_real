import { Server, Socket } from 'socket.io';
import { WebSocketState } from './state.js';
import { ConnectionManager } from './connection.js';
import { handleCursorMove } from './cursorHandlers.js';
import {
  handleCommentCreate,
  handleCommentUpdate,
  handleCommentDelete,
  handleReplyCreate,
  handleReplyUpdate,
  handleReplyDelete,
} from './commentHandlers.js';
import { ActivityService } from '../services/activityService.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomJoinEvent,
  RoomLeaveEvent,
} from '../types/websocket.js';
import logger from '../utils/logger.js';
import { config } from '../config/index.js';
import { generateRandomName } from '../utils/nameGenerator.js';

// Import singleton instances
import { userService } from '../services/userService.js';
import { roomCleanupService } from '../services/roomCleanupService.js';
const activityService = new ActivityService();

export function setupWebSocket(httpServer: any): void {
  // Initialize Socket.IO with proper typing
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      path: config.ws.path,
      pingTimeout: config.ws.pingTimeout,
      pingInterval: config.ws.pingInterval,
      cors: {
        origin: config.security.corsOrigin,
        methods: ['GET', 'POST']
      },
    },
  );

  // Initialize state and connection manager
  const wsState = new WebSocketState();
  const connectionManager = new ConnectionManager(wsState);

  // Schedule periodic cleanup
  roomCleanupService.schedulePeriodicCleanup();

  // Middleware to authenticate connections
  io.use(async (socket, next) => {
    try {
      const { user_id } = socket.handshake.auth;
     if (!user_id) {
        return next(new Error('Authentication failed'));
      }

      const displayName = generateRandomName();

      // Validate or create user session info
      socket.data.userId = user_id;
      socket.data.displayName = displayName;

      next();
    } catch (error) {
      console.log(error)
      logger.error('Authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', async (socket: Socket) => {
    try {
      await connectionManager.handleConnection(socket);
      const { userId, displayName } = socket.data;

      logger.info('Client connected', { userId, displayName });
      console.log(socket.data)
      // Room Events
      socket.on('room:join', async (event: RoomJoinEvent) => {
        try {
          // Add user to room using service
          await userService.createAnonymousUser(event.roomId);
          await wsState.addUserToRoom(
            socket,
            userId,
            event.roomId,
            displayName,
          );

          // Track join activity
          await activityService.logActivity(
            event.roomId,
            'USER_JOINED',
            userId,
            displayName,
            { connectionId: socket.data.connectionId },
          );

          // Get current room state
          const roomState = await wsState.getRoomState(event.roomId);

          // Get recent activities
          const recentActivities = await activityService.getActivityLog(
            event.roomId,
          );

          socket.emit('room:state', {
            ...roomState,
            recentActivities,
            timestamp: Date.now(),
            roomId: event.roomId,
            userId,
          });

          // Broadcast user joined
          socket.to(event.roomId).emit('room:userJoined', {
            userId,
            displayName,
            timestamp: Date.now(),
          });
        } catch (error) {
          logger.error('Error joining room:', error);
          socket.emit('error', {
            code: 'ROOM_JOIN_ERROR',
            message: 'Failed to join room',
          });
        }
      });

      socket.on('room:leave', async (event: RoomLeaveEvent) => {
        try {
          const roomId = event.roomId;
          await wsState.removeUserFromRoom(socket, userId);
          await userService.removeUserFromRoom(userId, roomId);

          // Track leave activity
          await activityService.logActivity(
            roomId,
            'USER_LEFT',
            userId,
            displayName,
            { reason: 'left' },
          );

          // Broadcast user left
          socket.to(roomId).emit('room:userLeft', {
            userId,
            displayName,
            timestamp: Date.now(),
          });
        } catch (error) {
          logger.error('Error leaving room:', error);
          socket.emit('error', {
            code: 'ROOM_LEAVE_ERROR',
            message: 'Failed to leave room',
          });
        }
      });

      // Cursor Events
      socket.on('cursor:move', data => {
        try {
          handleCursorMove(socket, userId, data, wsState);
        } catch (error) {
          logger.error('Error handling cursor movement:', error);
          socket.emit('error', {
            code: 'CURSOR_MOVE_ERROR',
            message: 'Failed to update cursor position',
          });
        }
      });

      // Comment Events
      socket.on('comment:create', data => {
        try {
          handleCommentCreate(socket, userId, displayName, data, wsState);
        } catch (error) {
          logger.error('Error creating comment:', error);
          socket.emit('error', {
            code: 'COMMENT_CREATE_ERROR',
            message: 'Failed to create comment',
          });
        }
      });

      socket.on('comment:update', data => {
        try {
          handleCommentUpdate(socket, userId, data, wsState);
        } catch (error) {
          logger.error('Error updating comment:', error);
          socket.emit('error', {
            code: 'COMMENT_UPDATE_ERROR',
            message: 'Failed to update comment',
          });
        }
      });

      socket.on('comment:delete', data => {
        try {
          handleCommentDelete(socket, userId, data, wsState);
        } catch (error) {
          logger.error('Error deleting comment:', error);
          socket.emit('error', {
            code: 'COMMENT_DELETE_ERROR',
            message: 'Failed to delete comment',
          });
        }
      });

      // Reply Events
      socket.on('reply:create', data => {
        try {
          handleReplyCreate(socket, userId, displayName, data, wsState);
        } catch (error) {
          logger.error('Error creating reply:', error);
          socket.emit('error', {
            code: 'REPLY_CREATE_ERROR',
            message: 'Failed to create reply',
          });
        }
      });

      socket.on('reply:update', data => {
        try {
          handleReplyUpdate(socket, userId, data, wsState);
        } catch (error) {
          logger.error('Error updating reply:', error);
          socket.emit('error', {
            code: 'REPLY_UPDATE_ERROR',
            message: 'Failed to update reply',
          });
        }
      });

      socket.on('reply:delete', data => {
        try {
          handleReplyDelete(socket, userId, data, wsState);
        } catch (error) {
          logger.error('Error deleting reply:', error);
          socket.emit('error', {
            code: 'REPLY_DELETE_ERROR',
            message: 'Failed to delete reply',
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async reason => {
        try {
          const roomId = wsState.getUserRoom(userId);
          if (roomId) {
            await wsState.removeUserFromRoom(socket, userId);
            await userService.removeUserFromRoom(userId, roomId);

            // Track disconnect activity
            await activityService.logActivity(
              roomId,
              'USER_LEFT',
              userId,
              displayName,
              { reason: 'disconnected' },
            );

            // Broadcast user disconnected
            socket.to(roomId).emit('room:userLeft', {
              userId,
              displayName,
              timestamp: Date.now(),
            });
          }

          logger.info('Client disconnected', {
            userId,
            displayName,
            reason,
          });
        } catch (error) {
          logger.error('Error handling disconnect:', error);
        }
      });
    } catch (error) {
      logger.error('Error handling connection:', error);
      socket.disconnect(true);
    }
  });
}
