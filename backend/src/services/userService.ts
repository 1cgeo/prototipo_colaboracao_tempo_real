import { db } from '../database/index.js';
import { generateRandomName } from '../utils/nameGenerator.js';
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
   * Create or update an anonymous user without room association
   */
  async createAnonymousUser(userId: string): Promise<{
    id: string;
    displayName: string;
  }> {
    try {
      // First try to find existing user
      const existingUser = await db.oneOrNone(
        `
        SELECT id, display_name as "displayName"
        FROM anonymous_users
        WHERE id = $1
        `,
        [userId],
      );

      if (existingUser) {
        // User exists, update last seen and return existing user
        await db.none(
          `
          UPDATE anonymous_users 
          SET last_seen_at = NOW()
          WHERE id = $1
          `,
          [userId],
        );

        logger.info('Updated existing anonymous user', {
          userId: existingUser.id,
          displayName: existingUser.displayName,
        });

        // Update active users cache
        this.activeUsers.set(existingUser.id, {
          displayName: existingUser.displayName,
          lastSeen: new Date(),
        });

        return existingUser;
      }

      // User doesn't exist, create new one
      const displayName = generateRandomName();

      const newUser = await db.one(
        `
        INSERT INTO anonymous_users (id, display_name)
        VALUES ($1, $2)
        RETURNING id, display_name as "displayName"
        `,
        [userId, displayName],
      );

      // Add to active users cache
      this.activeUsers.set(newUser.id, {
        displayName: newUser.displayName,
        lastSeen: new Date(),
      });

      logger.info('Created new anonymous user', {
        userId: newUser.id,
        displayName: newUser.displayName,
      });

      return newUser;
    } catch (error) {
      logger.error('Error in createAnonymousUser:', error);
      throw error;
    }
  }

  /**
   * Associate user with a room
   */
  async joinRoom(userId: string, roomId: string): Promise<void> {
    await db.tx(async t => {
      // Verify room exists
      const room = await t.oneOrNone(
        'SELECT uuid FROM map_rooms WHERE uuid = $1',
        [roomId],
      );

      if (!room) {
        throw new APIError(404, 'Room not found');
      }

      // Update user's room
      await t.none(
        `
        UPDATE anonymous_users
        SET map_room_uuid = $1,
            last_seen_at = NOW()
        WHERE id = $2
        `,
        [roomId, userId],
      );
    });

    logger.info('User joined room', { userId, roomId });
  }

  /**
   * Remove user from room
   */
  async leaveRoom(userId: string, roomId: string): Promise<void> {
    await db.none(
      `
      UPDATE anonymous_users
      SET map_room_uuid = NULL,
          last_seen_at = NOW()
      WHERE id = $1 AND map_room_uuid = $2
      `,
      [userId, roomId],
    );

    logger.info('User left room', { userId, roomId });
  }

  /**
   * Update user's last seen timestamp
   */
  async updateUserActivity(userId: string): Promise<void> {
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
      WHERE id = $1
      `,
      [userId],
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
   * Get user by ID
   */
  async getUser(userId: string): Promise<{
    id: string;
    displayName: string;
    roomId: string | null;
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
