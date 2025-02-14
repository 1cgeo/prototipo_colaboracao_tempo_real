import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketState } from './state.js';
import { UserService } from '../services/userService.js';
import { ActivityService } from '../services/activityService.js';
import { ConnectionState, ErrorEvent } from '../types/websocket.js';
import logger from '../utils/logger.js';

const userService = UserService.getInstance();
const activityService = new ActivityService();

export class ConnectionManager {
  private connections: Map<
    string,
    {
      socket: Socket;
      state: ConnectionState;
      lastActivity: Date;
    }
  >;
  private readonly ACTIVITY_TIMEOUT = 30000; // 30 seconds

  constructor(private wsState: WebSocketState) {
    this.connections = new Map();
    this.startHealthCheck();
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      logger.info('New socket connection attempt', {
        id: socket.id,
        auth: socket.handshake.auth,
      });

      const { user_id } = socket.handshake.auth;
      if (!user_id) {
        logger.error('Connection attempt without user_id', {
          id: socket.id,
        });
        throw new Error('Authentication failed: missing user_id');
      }

      const connectionId = uuidv4();
      logger.info('Generated connection ID', {
        connectionId,
        socketId: socket.id,
        userId: user_id,
      });

      // Store connection information
      this.connections.set(connectionId, {
        socket,
        state: 'connected',
        lastActivity: new Date(),
      });

      // Attach connection ID to socket for future reference
      socket.data.connection_id = connectionId;
      socket.data.user_id = user_id;

      logger.info('Creating anonymous user', {
        userId: user_id,
        connectionId,
      });

      // Create anonymous user
      const userInfo = await userService.createAnonymousUser(user_id);

      logger.info('Anonymous user created, sending user info', {
        userId: userInfo.id,
        displayName: userInfo.displayName,
        connectionId,
      });

      // Send user info to client
      socket.emit('user:info', {
        user_id: userInfo.id,
        display_name: userInfo.displayName,
      });

      // Setup event listeners
      this.setupEventListeners(socket);

      // Handle disconnection
      socket.on('disconnect', reason => {
        logger.info('Socket disconnect event', {
          reason,
          connectionId,
          userId: user_id,
        });
        this.handleDisconnect(socket, reason);
      });

      // Handle errors
      socket.on('error', error => {
        logger.error('Socket error event', {
          error,
          connectionId,
          userId: user_id,
        });
        this.handleError(socket, error);
      });

      logger.info('Connection setup completed successfully', {
        connectionId,
        userId: user_id,
      });
    } catch (error) {
      logger.error('Error handling connection:', {
        error,
        socketId: socket.id,
        auth: socket.handshake.auth,
      });
      socket.emit('error', {
        code: 'CONNECTION_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to establish connection',
      });
      socket.disconnect(true);
    }
  }

  private setupEventListeners(socket: Socket): void {
    const updateActivity = async () => {
      const connection = this.connections.get(socket.data.connection_id);
      if (connection) {
        connection.lastActivity = new Date();
        await userService.updateUserActivity(socket.data.user_id);
      }
    };

    socket.onAny((eventName, ...args) => {
      logger.debug('Socket event received', {
        eventName,
        args,
        connectionId: socket.data.connection_id,
        userId: socket.data.user_id,
      });
      updateActivity();
    });

    socket.on('ping', () => {
      updateActivity();
      socket.emit('pong');
    });
  }

  private async handleDisconnect(
    socket: Socket,
    reason: string,
  ): Promise<void> {
    const { connection_id, user_id } = socket.data;
    const connection = this.connections.get(connection_id);

    if (!connection) {
      logger.warn('Disconnect for unknown connection', {
        connectionId: connection_id,
        userId: user_id,
        reason,
      });
      return;
    }

    logger.info('Handling socket disconnect', {
      connectionId: connection_id,
      userId: user_id,
      reason,
    });

    connection.state = 'disconnected';
    this.connections.delete(connection_id);
    await this.handleFinalDisconnect(socket);
  }

  private async handleFinalDisconnect(socket: Socket): Promise<void> {
    const { user_id } = socket.data;
    const roomId = this.wsState.getUserRoom(user_id);

    if (roomId) {
      logger.info('User was in room, cleaning up', {
        userId: user_id,
        roomId,
      });

      await this.wsState.removeUserFromRoom(socket, user_id);
      await userService.leaveRoom(user_id, roomId);

      await activityService.logActivity(
        roomId,
        'USER_LEFT',
        user_id,
        this.wsState.getUserInfo(user_id)?.display_name || 'Unknown User',
        { reason: 'disconnected' },
      );

      socket.to(roomId).emit('room:user_left', {
        user_id,
        room_id: roomId,
        display_name: this.wsState.getUserInfo(user_id)?.display_name,
        timestamp: Date.now(),
      });
    }
  }

  private handleError(socket: Socket, error: Error): void {
    const errorEvent: ErrorEvent = {
      code: 'SOCKET_ERROR',
      message: 'A connection error occurred',
      details: error.message,
    };

    logger.error('Handling socket error', {
      error,
      connectionId: socket.data.connection_id,
      userId: socket.data.user_id,
    });

    socket.emit('error', errorEvent);
  }

  private startHealthCheck(): void {
    setInterval(() => {
      const now = new Date();
      for (const [connectionId, connection] of this.connections.entries()) {
        if (
          now.getTime() - connection.lastActivity.getTime() >
          this.ACTIVITY_TIMEOUT
        ) {
          logger.warn('Stale connection detected', { connectionId });
          connection.socket.disconnect(true);
          this.connections.delete(connectionId);
        }
      }
    }, this.ACTIVITY_TIMEOUT);
  }

  getConnectionState(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId)?.state;
  }

  getActiveConnectionsCount(): number {
    return Array.from(this.connections.values()).filter(
      conn => conn.state === 'connected',
    ).length;
  }
}
