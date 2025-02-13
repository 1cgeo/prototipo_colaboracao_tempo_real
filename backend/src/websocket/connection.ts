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

  /**
   * Handle new connection and create anonymous user
   */
  async handleConnection(socket: Socket): Promise<void> {
    try {
      const { user_id } = socket.handshake.auth;
      const connectionId = uuidv4();

      // Store connection information
      this.connections.set(connectionId, {
        socket,
        state: 'connected',
        lastActivity: new Date(),
      });

      // Attach connection ID to socket for future reference
      socket.data.connection_id = connectionId;
      socket.data.user_id = user_id;

      // Create anonymous user
      const userInfo = await userService.createAnonymousUser(user_id);

      // Send user info to client
      socket.emit('user:info', {
        user_id: userInfo.id,
        display_name: userInfo.displayName,
      });

      logger.info('New connection established', {
        connection_id: connectionId,
        user_id: userInfo.id,
        display_name: userInfo.displayName,
      });

      // Setup event listeners
      this.setupEventListeners(socket);

      // Handle disconnection
      socket.on('disconnect', reason => {
        this.handleDisconnect(socket, reason);
      });

      // Handle errors
      socket.on('error', error => {
        this.handleError(socket, error);
      });
    } catch (error) {
      logger.error('Error handling new connection:', error);
      socket.emit('error', {
        code: 'CONNECTION_ERROR',
        message: 'Failed to establish connection',
      });
      socket.disconnect(true);
    }
  }

  /**
   * Setup event listeners for connection monitoring
   */
  private setupEventListeners(socket: Socket): void {
    // Monitor activity
    const updateActivity = async () => {
      const connection = this.connections.get(socket.data.connection_id);
      if (connection) {
        connection.lastActivity = new Date();

        // Update user activity
        await userService.updateUserActivity(socket.data.user_id);
      }
    };

    // Update activity on any event
    socket.onAny(updateActivity);

    // Handle ping/pong
    socket.on('ping', () => {
      updateActivity();
      socket.emit('pong');
    });
  }

  /**
   * Handle disconnection
   */
  private async handleDisconnect(
    socket: Socket,
    reason: string,
  ): Promise<void> {
    const { connection_id, user_id } = socket.data;
    const connection = this.connections.get(connection_id);

    if (!connection) return;

    logger.info('Client disconnected', {
      connection_id,
      user_id,
      reason,
    });

    // Update connection state
    connection.state = 'disconnected';

    // Clean up connection
    this.connections.delete(connection_id);
    await this.handleFinalDisconnect(socket);
  }

  /**
   * Handle final disconnection and cleanup
   */
  private async handleFinalDisconnect(socket: Socket): Promise<void> {
    const { user_id } = socket.data;
    const roomId = this.wsState.getUserRoom(user_id);

    if (roomId) {
      // Remove user from room
      await this.wsState.removeUserFromRoom(socket, user_id);
      await userService.leaveRoom(user_id, roomId);

      // Log activity
      await activityService.logActivity(
        roomId,
        'USER_LEFT',
        user_id,
        this.wsState.getUserInfo(user_id)?.display_name || 'Unknown User',
        { reason: 'disconnected' },
      );

      // Notify room of user departure
      socket.to(roomId).emit('room:user_left', {
        user_id,
        room_id: roomId,
        display_name: this.wsState.getUserInfo(user_id)?.display_name,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle connection errors
   */
  private handleError(socket: Socket, error: Error): void {
    const errorEvent: ErrorEvent = {
      code: 'SOCKET_ERROR',
      message: 'A connection error occurred',
      details: error.message,
    };

    logger.error('Socket error:', {
      connection_id: socket.data.connection_id,
      user_id: socket.data.user_id,
      error,
    });

    socket.emit('error', errorEvent);
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    setInterval(() => {
      const now = new Date();
      for (const [connectionId, connection] of this.connections.entries()) {
        // Check for stale connections
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

  /**
   * Get connection state
   */
  getConnectionState(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId)?.state;
  }

  /**
   * Get active connections count
   */
  getActiveConnectionsCount(): number {
    return Array.from(this.connections.values()).filter(
      conn => conn.state === 'connected',
    ).length;
  }
}
