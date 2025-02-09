import { db } from '../database/index.js';
import { ActivityType } from '../types/index.js';
import { Socket } from 'socket.io';
import logger from '../utils/logger.js';

export class ActivityService {
  /**
   * Log a new activity
   */
  async logActivity(
    roomId: string,
    activityType: ActivityType,
    userId: string,
    userName: string,
    metadata?: Record<string, unknown>,
  ) {
    await db.none(
      `
      INSERT INTO activity_logs (
        map_room_uuid,
        activity_type,
        user_id,
        user_name,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [roomId, activityType, userId, userName, metadata],
    );

    logger.debug('Logged activity', {
      roomId,
      activityType,
      userId,
      metadata,
    });
  }

  /**
   * Get activity log with pagination
   */
  async getActivityLog(roomId: string, limit = 50, before?: Date) {
    const activities = await db.any(
      `
      SELECT 
        id,
        activity_type as "activityType",
        user_id as "userId",
        user_name as "userName",
        metadata,
        created_at as "createdAt"
      FROM activity_logs
      WHERE map_room_uuid = $1
        ${before ? 'AND created_at < $3' : ''}
      ORDER BY created_at DESC
      LIMIT $2
      `,
      before ? [roomId, limit, before] : [roomId, limit],
    );

    logger.debug('Retrieved activity log', {
      roomId,
      count: activities.length,
      limit,
      before,
    });

    return activities;
  }

  /**
   * Get user activity with pagination
   */
  async getUserActivity(
    roomId: string,
    userId: string,
    limit = 50,
    before?: Date,
  ) {
    const activities = await db.any(
      `
      SELECT 
        id,
        activity_type as "activityType",
        user_id as "userId",
        user_name as "userName",
        metadata,
        created_at as "createdAt"
      FROM activity_logs
      WHERE map_room_uuid = $1
        AND user_id = $2
        ${before ? 'AND created_at < $4' : ''}
      ORDER BY created_at DESC
      LIMIT $3
      `,
      before ? [roomId, userId, limit, before] : [roomId, userId, limit],
    );

    logger.debug('Retrieved user activity', {
      roomId,
      userId,
      count: activities.length,
      limit,
      before,
    });

    return activities;
  }

  /**
   * Track and broadcast room activity
   */
  async trackAndBroadcastActivity(
    socket: Socket,
    roomId: string,
    userId: string,
    userName: string,
    activityType: ActivityType,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Log to database
      await this.logActivity(roomId, activityType, userId, userName, metadata);

      // Broadcast to room
      socket.to(roomId).emit('room:activity', {
        type: activityType,
        userId,
        userName,
        metadata,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error tracking activity:', error);
    }
  }

  /**
   * Check if a room has had any activity recently
   */
  async hasRecentActivity(
    roomId: string,
    minutes: number = 5,
  ): Promise<boolean> {
    try {
      const result = await db.oneOrNone(
        `
        SELECT 1
        FROM activity_logs
        WHERE map_room_uuid = $1
          AND created_at > NOW() - interval '$2 minutes'
        LIMIT 1
        `,
        [roomId, minutes],
      );
      return !!result;
    } catch (error) {
      logger.error('Error checking recent activity:', error);
      return false;
    }
  }

  /**
   * Clean up old activities
   */
  async cleanOldActivities(days: number = 30): Promise<void> {
    try {
      const result = await db.result(
        `
        DELETE FROM activity_logs
        WHERE created_at < NOW() - interval '$1 days'
        `,
        [days],
      );

      if (result.rowCount > 0) {
        logger.info('Cleaned old activities', {
          removedCount: result.rowCount,
        });
      }
    } catch (error) {
      logger.error('Error cleaning up old activities:', error);
    }
  }

  /**
   * Get activity summary for a room
   */
  async getActivitySummary(roomId: string) {
    const summary = await db.one(
      `
      SELECT 
        COUNT(*) as total_activities,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(created_at) as last_activity,
        json_object_agg(
          activity_type, 
          COUNT(*)
        ) as activity_counts
      FROM activity_logs
      WHERE map_room_uuid = $1
      GROUP BY map_room_uuid
    `,
      [roomId],
    );

    logger.debug('Retrieved activity summary', {
      roomId,
      summary,
    });

    return summary;
  }
}
