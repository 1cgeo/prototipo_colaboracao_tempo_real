import { db } from '../database/index.js';
import { APIError } from '../middleware/error.js';
import { CreateMapRoomRequest } from '../types/index.js';
import logger from '../utils/logger.js';

export class MapService {
  /**
   * List all map rooms with optimization for spatial queries
   */
  async listMapRooms() {
    const rooms = await db.any(`
      WITH room_stats AS (
        SELECT 
          au.map_room_uuid,
          COUNT(DISTINCT au.id) as recent_users,
          COUNT(DISTINCT c.id) as comment_count
        FROM anonymous_users au
        LEFT JOIN spatial_comments c ON c.map_room_uuid = au.map_room_uuid
        WHERE au.last_seen_at > NOW() - INTERVAL '5 minutes'
        GROUP BY au.map_room_uuid
      )
      SELECT 
        m.uuid,
        m.name,
        m.description,
        m.active_users_count,
        COALESCE(rs.recent_users, 0) as current_users,
        COALESCE(rs.comment_count, 0) as comment_count,
        m.created_at,
        m.updated_at
      FROM map_rooms m
      LEFT JOIN room_stats rs ON rs.map_room_uuid = m.uuid
      ORDER BY m.updated_at DESC
    `);

    logger.debug('Listed map rooms', { count: rooms.length });
    return rooms;
  }

  /**
   * Get detailed map room information with spatial optimization
   */
  async getMapRoom(uuid: string) {
    const room = await db.oneOrNone(
      `
      SELECT 
        m.*,
        count(DISTINCT c.id) as comment_count,
        count(DISTINCT au.id) as current_users
      FROM map_rooms m
      LEFT JOIN spatial_comments c ON c.map_room_uuid = m.uuid
      LEFT JOIN anonymous_users au ON au.map_room_uuid = m.uuid 
        AND au.last_seen_at > NOW() - INTERVAL '5 minutes'
      WHERE m.uuid = $1
      GROUP BY m.uuid
    `,
      [uuid],
    );

    if (!room) {
      throw new APIError(404, 'Map room not found');
    }

    // Get active users using window of 5 minutes
    const users = await db.any(
      `
      SELECT id, display_name as "displayName", joined_at as "joinedAt"
      FROM anonymous_users
      WHERE map_room_uuid = $1
        AND last_seen_at > NOW() - INTERVAL '5 minutes'
    `,
      [uuid],
    );

    // Get recent activity with efficient limit
    const activity = await db.any(
      `
      SELECT 
        id, 
        activity_type as type,
        user_name as "userName",
        metadata,
        created_at as "createdAt"
      FROM activity_logs
      WHERE map_room_uuid = $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
      [uuid],
    );

    logger.debug('Retrieved map room details', {
      uuid,
      users: users.length,
      activities: activity.length,
    });

    return {
      ...room,
      users,
      activity,
    };
  }

  /**
   * Create a new map room
   */
  async createMapRoom(data: CreateMapRoomRequest) {
    const room = await db.one(
      `
      INSERT INTO map_rooms (name, description)
      VALUES ($1, $2)
      RETURNING *
    `,
      [data.name, data.description],
    );

    logger.info('Created new map room', { uuid: room.uuid });
    return room;
  }

  /**
   * Update map room details
   */
  async updateMapRoom(uuid: string, data: CreateMapRoomRequest) {
    const room = await db.oneOrNone(
      `
      UPDATE map_rooms
      SET 
        name = $1,
        description = $2,
        updated_at = NOW()
      WHERE uuid = $3
      RETURNING *
    `,
      [data.name, data.description, uuid],
    );

    if (!room) {
      throw new APIError(404, 'Map room not found');
    }

    logger.info('Updated map room', { uuid });
    return room;
  }

  /**
   * Delete a map room and all associated data
   */
  async deleteMapRoom(uuid: string) {
    const result = await db.result(
      `
      DELETE FROM map_rooms
      WHERE uuid = $1
    `,
      [uuid],
    );

    if (result.rowCount === 0) {
      throw new APIError(404, 'Map room not found');
    }

    logger.info('Deleted map room', { uuid });
    return true;
  }

  /**
   * Get spatial statistics for a map room
   */
  async getMapRoomStats(uuid: string) {
    const stats = await db.one(
      `
      WITH comment_stats AS (
        SELECT 
          COUNT(*) as total_comments,
          COUNT(DISTINCT author_id) as unique_authors,
          ST_Extent(location::geometry) as bounds
        FROM spatial_comments
        WHERE map_room_uuid = $1
      ),
      activity_stats AS (
        SELECT 
          COUNT(*) as total_activities,
          COUNT(DISTINCT user_id) as total_users
        FROM activity_logs
        WHERE map_room_uuid = $1
      )
      SELECT 
        cs.total_comments,
        cs.unique_authors,
        ST_AsGeoJSON(cs.bounds)::json as bounds,
        acs.total_activities,
        acs.total_users
      FROM comment_stats cs
      CROSS JOIN activity_stats acs
    `,
      [uuid],
    );

    logger.debug('Retrieved map room statistics', { uuid, stats });
    return stats;
  }
}
