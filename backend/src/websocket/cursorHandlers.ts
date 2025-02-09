import { Socket } from 'socket.io';
import { WebSocketState } from './state.js';
import { CursorMoveEvent } from '../types/websocket.js';
import wsLogger from '../utils/logger.js';
import { cursorThrottler } from './cursorThrottle.js';

export const handleCursorMove = async (
  socket: Socket,
  userId: string,
  data: CursorMoveEvent,
  state: WebSocketState,
) => {
  try {
    const { location } = data;
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      wsLogger.warn('User tried to move cursor without being in a room', {
        userId,
      });
      return;
    }

    // Use cursor throttler to handle the update
    cursorThrottler.updateCursor(userId, roomId, location, update => {
      // Broadcast to room
      socket.to(roomId).emit('cursor:update', {
        userId,
        location: update.location,
        timestamp: update.timestamp,
      });
    });
  } catch (error) {
    wsLogger.error('Error handling cursor movement:', error);
    socket.emit('error', { message: 'Invalid cursor position data' });
  }
};
