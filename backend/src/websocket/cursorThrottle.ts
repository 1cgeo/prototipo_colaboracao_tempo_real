import cursorLogger from '../utils/logger.js';

interface CursorPosition {
  userId: string;
  roomId: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  timestamp: number;
}

class CursorThrottler {
  private positions: Map<string, CursorPosition>;
  private updateQueue: Map<string, NodeJS.Timeout>;
  private readonly THROTTLE_DELAY = 100; // ms
  private readonly DISTANCE_THRESHOLD = 0.0001; // Approximately 11 meters at equator

  constructor() {
    this.positions = new Map();
    this.updateQueue = new Map();
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(
    point1: [number, number],
    point2: [number, number],
  ): number {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;
    return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
  }

  /**
   * Check if cursor movement is significant
   */
  private isSignificantMovement(
    oldPos: CursorPosition,
    newPos: CursorPosition,
  ): boolean {
    const distance = this.calculateDistance(
      oldPos.location.coordinates,
      newPos.location.coordinates,
    );
    return distance > this.DISTANCE_THRESHOLD;
  }

  /**
   * Get throttled cursor update
   */
  updateCursor(
    userId: string,
    roomId: string,
    location: { type: 'Point'; coordinates: [number, number] },
    callback: (update: CursorPosition) => void,
  ): void {
    const key = `${roomId}:${userId}`;
    const now = Date.now();
    const newPosition: CursorPosition = {
      userId,
      roomId,
      location,
      timestamp: now,
    };

    // Check if there's a significant movement
    const currentPosition = this.positions.get(key);
    const isSignificant =
      !currentPosition ||
      this.isSignificantMovement(currentPosition, newPosition);

    // Update the stored position
    this.positions.set(key, newPosition);

    // Clear any existing timeout
    if (this.updateQueue.has(key)) {
      clearTimeout(this.updateQueue.get(key));
    }

    // If movement is significant, send update immediately
    if (isSignificant) {
      callback(newPosition);
      cursorLogger.debug({
        type: 'cursor_update',
        userId,
        roomId,
        location,
        immediate: true,
      });
      return;
    }

    // Otherwise, queue the update with throttling
    this.updateQueue.set(
      key,
      setTimeout(() => {
        callback(newPosition);
        this.updateQueue.delete(key);
        cursorLogger.debug({
          type: 'cursor_update',
          userId,
          roomId,
          location,
          throttled: true,
        });
      }, this.THROTTLE_DELAY),
    );
  }

  /**
   * Batch update multiple cursors
   */
  batchUpdateCursors(
    updates: CursorPosition[],
    callback: (updates: CursorPosition[]) => void,
  ): void {
    const batch: CursorPosition[] = [];
    const processedKeys = new Set<string>();

    for (const update of updates) {
      const posKey = `${update.roomId}:${update.userId}`;

      // Skip duplicates in batch
      if (processedKeys.has(posKey)) continue;
      processedKeys.add(posKey);

      const currentPosition = this.positions.get(posKey);
      const isSignificant =
        !currentPosition || this.isSignificantMovement(currentPosition, update);

      if (isSignificant) {
        batch.push(update);
        this.positions.set(posKey, update);
      }
    }

    if (batch.length > 0) {
      callback(batch);
      cursorLogger.debug({
        type: 'cursor_batch_update',
        count: batch.length,
        rooms: [...new Set(batch.map(u => u.roomId))],
      });
    }
  }

  /**
   * Clean up stale cursors
   */
  cleanupStaleCursors(maxAge: number = 30000): void {
    const now = Date.now();
    this.positions.forEach((position, posKey) => {
      if (now - position.timestamp > maxAge) {
        this.positions.delete(posKey);
        if (this.updateQueue.has(posKey)) {
          clearTimeout(this.updateQueue.get(posKey));
          this.updateQueue.delete(posKey);
        }
      }
    });
  }

  /**
   * Remove user cursor
   */
  removeCursor(userId: string, roomId: string): void {
    const posKey = `${roomId}:${userId}`;
    this.positions.delete(posKey);
    if (this.updateQueue.has(posKey)) {
      clearTimeout(this.updateQueue.get(posKey));
      this.updateQueue.delete(posKey);
    }
  }

  /**
   * Get current cursor positions for a room
   */
  getRoomCursors(roomId: string): CursorPosition[] {
    const cursors: CursorPosition[] = [];
    this.positions.forEach(position => {
      if (position.roomId === roomId) {
        cursors.push(position);
      }
    });
    return cursors;
  }
}

// Export singleton instance
export const cursorThrottler = new CursorThrottler();

// Start cleanup interval
setInterval(() => {
  cursorThrottler.cleanupStaleCursors();
}, 10000); // Run every 10 seconds
