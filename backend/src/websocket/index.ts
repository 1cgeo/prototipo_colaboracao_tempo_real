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
        methods: ['GET', 'POST'],
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
      console.log(socket.handshake.auth);

      if (!user_id) {
        return next(new Error('Authentication failed: missing user_id'));
      }

      // Store user data in socket
      socket.data.user_id = user_id;

      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', async (socket: Socket) => {
    try {
      console.log('connection');
      await connectionManager.handleConnection(socket);
      const { user_id } = socket.data;

      logger.info('Client connected', { user_id });

      // Room Events
      socket.on('room:join', async (event: RoomJoinEvent) => {
        try {
          if (!event.room_id) {
            throw new Error('Missing room_id');
          }

          // Add user to room using service
          await userService.createAnonymousUser(event.room_id);
          await wsState.addUserToRoom(
            socket,
            user_id,
            event.room_id,
            event.display_name,
          );

          // Track join activity
          await activityService.logActivity(
            event.room_id,
            'USER_JOINED',
            user_id,
            event.display_name,
            { connection_id: socket.data.connection_id },
          );

          // Get current room state
          const roomState = await wsState.getRoomState(event.room_id);

          // Get recent activities
          const recentActivities = await activityService.getActivityLog(
            event.room_id,
          );

          socket.emit('room:state', {
            ...roomState,
            recentActivities,
            timestamp: Date.now(),
            room_id: event.room_id,
            user_id,
          });

          // Broadcast user joined
          socket.to(event.room_id).emit('room:user_joined', {
            user_id,
            display_name: event.display_name,
            timestamp: Date.now(),
            room_id: event.room_id,
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
          const roomId = event.room_id;
          if (!roomId) {
            throw new Error('Missing room_id');
          }

          await wsState.removeUserFromRoom(socket, user_id);
          await userService.leaveRoom(user_id, roomId);

          // Track leave activity
          await activityService.logActivity(
            roomId,
            'USER_LEFT',
            user_id,
            socket.data.display_name || 'Unknown User',
            { reason: 'left' },
          );

          // Broadcast user left
          socket.to(roomId).emit('room:user_left', {
            user_id,
            room_id: roomId,
            display_name: socket.data.display_name,
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
          handleCursorMove(socket, user_id, data, wsState);
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
          handleCommentCreate(
            socket,
            user_id,
            socket.data.display_name,
            data,
            wsState,
          );
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
          handleCommentUpdate(socket, user_id, data, wsState);
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
          handleCommentDelete(socket, user_id, data, wsState);
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
          handleReplyCreate(
            socket,
            user_id,
            socket.data.display_name,
            data,
            wsState,
          );
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
          handleReplyUpdate(socket, user_id, data, wsState);
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
          handleReplyDelete(socket, user_id, data, wsState);
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
          const roomId = wsState.getUserRoom(user_id);
          if (roomId) {
            await wsState.removeUserFromRoom(socket, user_id);
            await userService.leaveRoom(user_id, roomId);

            // Track disconnect activity
            await activityService.logActivity(
              roomId,
              'USER_LEFT',
              user_id,
              socket.data.display_name || 'Unknown User',
              { reason: 'disconnected' },
            );

            // Broadcast user disconnected
            socket.to(roomId).emit('room:user_left', {
              user_id,
              room_id: roomId,
              display_name: socket.data.display_name,
              timestamp: Date.now(),
            });
          }

          logger.info('Client disconnected', {
            user_id,
            display_name: socket.data.display_name,
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
