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
   * Handle new connection
   */
  async handleConnection(socket: Socket): Promise<void> {
    try {
      const { user_id, displayName } = socket.handshake.auth;
      console.log(user_id, displayName)
      const connectionId = uuidv4();

      // Store connection information
      this.connections.set(connectionId, {
        socket,
        state: 'connected',
        lastActivity: new Date(),
      });

      // Attach connection ID to socket for future reference
      socket.data.connectionId = connectionId;
      socket.data.userId = user_id;

      logger.info('New connection established', {
        connectionId,
        user_id,
        displayName,
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
      const connection = this.connections.get(socket.data.connectionId);
      if (connection) {
        connection.lastActivity = new Date();

        // Update user activity if in a room
        const roomId = this.wsState.getUserRoom(socket.data.userId);
        if (roomId) {
          await userService.updateUserActivity(socket.data.userId, roomId);
        }
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
    const { connectionId, userId } = socket.data;
    const connection = this.connections.get(connectionId);

    if (!connection) return;

    logger.info('Client disconnected', {
      connectionId,
      userId,
      reason,
    });

    // Update connection state
    connection.state = 'disconnected';

    // Clean up connection
    this.connections.delete(connectionId);
    await this.handleFinalDisconnect(socket);
  }

  /**
   * Handle final disconnection
   */
  private async handleFinalDisconnect(socket: Socket): Promise<void> {
    const { userId } = socket.data;
    const roomId = this.wsState.getUserRoom(userId);

    if (roomId) {
      await this.wsState.removeUserFromRoom(socket, userId);
      await userService.removeUserFromRoom(userId, roomId);

      // Log activity
      await activityService.logActivity(
        roomId,
        'USER_LEFT',
        userId,
        this.wsState.getUserInfo(userId)?.displayName || 'Unknown User',
        { reason: 'disconnected' },
      );

      // Notify room of user departure
      socket.to(roomId).emit('room:userLeft', {
        userId,
        displayName: this.wsState.getUserInfo(userId)?.displayName,
        timestamp: new Date().toISOString(),
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
      connectionId: socket.data.connectionId,
      userId: socket.data.userId,
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
