import { db } from '../database/index.js';
import {
  generateRandomName,
  isValidGeneratedName,
} from '../utils/nameGenerator.js';
import logger from '../utils/logger.js';
import { APIError } from '../middleware/error.js';

export class UserService {
  private static instance: UserService;
  private activeUsers: Map<string, { displayName: string; lastSeen: Date }>;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.activeUsers = new Map();
    this.startCleanupInterval();
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Create or get an anonymous user
   */
  async createAnonymousUser(roomId: string): Promise<{
    userId: string;
    displayName: string;
  }> {
    // Generate a unique display name
    let displayName: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      displayName = generateRandomName();
      const exists = await this.checkNameExists(roomId, displayName);
      if (!exists) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new APIError(500, 'Failed to generate unique display name');
    }

    // Create new user
    const user = await db.one(
      `
      INSERT INTO anonymous_users (display_name, map_room_uuid)
      VALUES ($1, $2)
      RETURNING id, display_name as "displayName"
      `,
      [displayName, roomId],
    );

    // Add to active users
    this.activeUsers.set(user.id, {
      displayName: user.displayName,
      lastSeen: new Date(),
    });

    logger.info('Created anonymous user', {
      userId: user.id,
      displayName: user.displayName,
      roomId,
    });

    return user;
  }

  /**
   * Update user's last seen timestamp
   */
  async updateUserActivity(userId: string, roomId: string): Promise<void> {
    const now = new Date();

    // Update memory cache
    const userInfo = this.activeUsers.get(userId);
    if (userInfo) {
      userInfo.lastSeen = now;
    }

    // Update database
    await db.none(
      `
      UPDATE anonymous_users
      SET last_seen_at = NOW()
      WHERE id = $1 AND map_room_uuid = $2
      `,
      [userId, roomId],
    );
  }

  /**
   * Get active users in a room
   */
  async getRoomUsers(roomId: string): Promise<
    Array<{
      id: string;
      displayName: string;
      joinedAt: Date;
      lastSeen: Date;
    }>
  > {
    return db.any(
      `
      SELECT 
        id,
        display_name as "displayName",
        joined_at as "joinedAt",
        last_seen_at as "lastSeen"
      FROM anonymous_users
      WHERE map_room_uuid = $1
        AND last_seen_at > NOW() - INTERVAL '5 minutes'
      ORDER BY joined_at DESC
      `,
      [roomId],
    );
  }

  /**
   * Check if a display name exists in a room
   */
  private async checkNameExists(
    roomId: string,
    displayName: string,
  ): Promise<boolean> {
    const exists = await db.oneOrNone(
      `
      SELECT 1
      FROM anonymous_users
      WHERE map_room_uuid = $1
        AND display_name = $2
        AND last_seen_at > NOW() - INTERVAL '5 minutes'
      `,
      [roomId, displayName],
    );
    return !!exists;
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<{
    id: string;
    displayName: string;
    roomId: string;
    joinedAt: Date;
    lastSeen: Date;
  } | null> {
    return db.oneOrNone(
      `
      SELECT 
        id,
        display_name as "displayName",
        map_room_uuid as "roomId",
        joined_at as "joinedAt",
        last_seen_at as "lastSeen"
      FROM anonymous_users
      WHERE id = $1
      `,
      [userId],
    );
  }

  /**
   * Change user's display name
   */
  async changeDisplayName(
    userId: string,
    newDisplayName: string,
  ): Promise<void> {
    // Validate new name
    if (!isValidGeneratedName(newDisplayName)) {
      throw new APIError(400, 'Invalid display name format');
    }

    const user = await this.getUser(userId);
    if (!user) {
      throw new APIError(404, 'User not found');
    }

    // Check if name exists in room
    const exists = await this.checkNameExists(user.roomId, newDisplayName);
    if (exists) {
      throw new APIError(409, 'Display name already in use in this room');
    }

    // Update name
    await db.none(
      `
      UPDATE anonymous_users
      SET display_name = $1
      WHERE id = $2
      `,
      [newDisplayName, userId],
    );

    // Update cache
    const userInfo = this.activeUsers.get(userId);
    if (userInfo) {
      userInfo.displayName = newDisplayName;
    }
  }

  /**
   * Remove user from room
   */
  async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
    await db.none(
      `
      UPDATE anonymous_users
      SET last_seen_at = NOW() - INTERVAL '10 minutes'
      WHERE id = $1 AND map_room_uuid = $2
      `,
      [userId, roomId],
    );

    this.activeUsers.delete(userId);
  }

  /**
   * Start cleanup interval for inactive users
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Cleanup memory cache
      for (const [userId, userInfo] of this.activeUsers.entries()) {
        if (userInfo.lastSeen < fiveMinutesAgo) {
          this.activeUsers.delete(userId);
        }
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Get user statistics for a room
   */
  async getRoomUserStats(roomId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    averageSessionDuration: number;
  }> {
    return db.one(
      `
      WITH user_stats AS (
        SELECT 
          COUNT(DISTINCT id) as total_users,
          COUNT(DISTINCT CASE 
            WHEN last_seen_at > NOW() - INTERVAL '5 minutes' 
            THEN id 
          END) as active_users,
          AVG(
            EXTRACT(EPOCH FROM (last_seen_at - joined_at))
          ) as avg_session_seconds
        FROM anonymous_users
        WHERE map_room_uuid = $1
      )
      SELECT 
        total_users as "totalUsers",
        active_users as "activeUsers",
        ROUND(avg_session_seconds / 60, 2) as "averageSessionDuration"
      FROM user_stats
      `,
      [roomId],
    );
  }
}

// Export singleton instance
export const userService = UserService.getInstance();
