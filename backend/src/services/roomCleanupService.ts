import { db } from '../database/index.js';
import logger from '../utils/logger.js';
import { APIError } from '../middleware/error.js';

class RoomCleanupService {
  /**
   * Clean up all resources associated with a room
   */
  async cleanupRoom(roomId: string): Promise<void> {
    try {
      await db.tx(async t => {
        logger.info('Starting room cleanup', { roomId });

        // Get room info first to verify it exists
        const room = await t.oneOrNone(
          'SELECT uuid FROM map_rooms WHERE uuid = $1',
          [roomId],
        );

        if (!room) {
          throw new APIError(404, 'Room not found');
        }

        // Delete all cursor positions
        await t.none('DELETE FROM cursor_positions WHERE map_room_uuid = $1', [
          roomId,
        ]);
        logger.debug('Cleaned cursor positions', { roomId });

        // Delete all comment replies
        await t.none(
          `
          DELETE FROM comment_replies 
          WHERE comment_id IN (
            SELECT id FROM spatial_comments WHERE map_room_uuid = $1
          )`,
          [roomId],
        );
        logger.debug('Cleaned comment replies', { roomId });

        // Delete all spatial comments
        await t.none('DELETE FROM spatial_comments WHERE map_room_uuid = $1', [
          roomId,
        ]);
        logger.debug('Cleaned spatial comments', { roomId });

        // Delete all version history for the room's entities
        await t.none(
          `
          DELETE FROM version_history 
          WHERE entity_id IN (
            SELECT id::text FROM spatial_comments WHERE map_room_uuid = $1
            UNION
            SELECT id::text FROM comment_replies 
            WHERE comment_id IN (
              SELECT id FROM spatial_comments WHERE map_room_uuid = $1
            )
          )`,
          [roomId],
        );
        logger.debug('Cleaned version history', { roomId });

        // Delete all activity logs
        await t.none('DELETE FROM activity_logs WHERE map_room_uuid = $1', [
          roomId,
        ]);
        logger.debug('Cleaned activity logs', { roomId });

        // Delete all anonymous users
        await t.none('DELETE FROM anonymous_users WHERE map_room_uuid = $1', [
          roomId,
        ]);
        logger.debug('Cleaned anonymous users', { roomId });

        // Finally, delete the room itself
        await t.none('DELETE FROM map_rooms WHERE uuid = $1', [roomId]);
        logger.info('Room cleanup completed', { roomId });
      });
    } catch (error) {
      logger.error('Error during room cleanup:', error);
      throw error;
    }
  }

  /**
   * Clean up inactive rooms
   * @param inactiveDays Number of days of inactivity before cleanup
   */
  async cleanupInactiveRooms(inactiveDays: number = 30): Promise<void> {
    try {
      const inactiveRooms = await db.any(`
        SELECT uuid 
        FROM map_rooms 
        WHERE updated_at < NOW() - INTERVAL '${inactiveDays} days'
          AND NOT EXISTS (
            SELECT 1 
            FROM anonymous_users 
            WHERE map_room_uuid = map_rooms.uuid 
              AND last_seen_at > NOW() - INTERVAL '5 minutes'
          )
      `);

      logger.info('Found inactive rooms', { count: inactiveRooms.length });

      for (const room of inactiveRooms) {
        try {
          await this.cleanupRoom(room.uuid);
        } catch (error) {
          logger.error('Error cleaning up inactive room:', {
            roomId: room.uuid,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Error during inactive rooms cleanup:', error);
      throw error;
    }
  }

  /**
   * Schedule periodic cleanup of inactive rooms
   */
  schedulePeriodicCleanup(intervalHours: number = 24): void {
    setInterval(
      () => {
        this.cleanupInactiveRooms().catch(error => {
          logger.error('Scheduled room cleanup failed:', error);
        });
      },
      intervalHours * 60 * 60 * 1000,
    );
  }

  /**
   * Get room cleanup statistics
   */
  async getRoomCleanupStats(): Promise<{
    totalRooms: number;
    inactiveRooms: number;
    averageRoomLifespan: number;
    totalResourcesCleaned: number;
  }> {
    return db.one(`
      WITH room_stats AS (
        SELECT 
          COUNT(*) as total_rooms,
          COUNT(*) FILTER (
            WHERE updated_at < NOW() - INTERVAL '30 days'
          ) as inactive_rooms,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_lifespan
      ),
      resource_stats AS (
        SELECT 
          COUNT(*) as total_resources
        FROM (
          SELECT id FROM spatial_comments
          UNION ALL
          SELECT id FROM comment_replies
          UNION ALL
          SELECT id FROM activity_logs
          UNION ALL
          SELECT id FROM anonymous_users
        ) resources
      )
      SELECT 
        rs.total_rooms as "totalRooms",
        rs.inactive_rooms as "inactiveRooms",
        ROUND(rs.avg_lifespan / 3600, 2) as "averageRoomLifespan",
        rss.total_resources as "totalResourcesCleaned"
      FROM room_stats rs, resource_stats rss
    `);
  }
}

// Export singleton instance
export const roomCleanupService = new RoomCleanupService();
