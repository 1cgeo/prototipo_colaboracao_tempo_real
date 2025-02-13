import { Socket } from 'socket.io';
import { db } from '../database/index.js';
import logger from '../utils/logger.js';

interface UserInfo {
  display_name: string;
  room_id: string | null;
  socket: Socket;
}

export interface UserPublicInfo {
  display_name: string;
  room_id: string | null;
}

export class WebSocketState {
  private connectedUsers: Map<string, Set<string>>;
  private userInfo: Map<string, UserInfo>;

  constructor() {
    this.connectedUsers = new Map();
    this.userInfo = new Map();
  }

  async addUserToRoom(
    socket: Socket,
    userId: string,
    roomId: string,
    displayName: string,
  ) {
    // Add to room state
    if (!this.connectedUsers.has(roomId)) {
      this.connectedUsers.set(roomId, new Set());
    }
    this.connectedUsers.get(roomId)?.add(userId);

    // Store user info
    this.userInfo.set(userId, {
      display_name: displayName,
      room_id: roomId,
      socket,
    });

    // Join socket.io room
    await socket.join(roomId);

    // Update database - apenas atualiza o room_id
    await db.tx(async t => {
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

      // Log activity
      await t.none(
        `
        INSERT INTO activity_logs (map_room_uuid, activity_type, user_id, user_name)
        VALUES ($1, $2, $3, $4)
      `,
        [roomId, 'USER_JOINED', userId, displayName],
      );
    });

    logger.info('User added to room', {
      userId,
      roomId,
      displayName,
    });
  }

  async removeUserFromRoom(socket: Socket, userId: string) {
    const userInfo = this.userInfo.get(userId);
    if (!userInfo || !userInfo.room_id) return;

    const roomId = userInfo.room_id;

    // Remove from room state
    this.connectedUsers.get(roomId)?.delete(userId);
    if (this.connectedUsers.get(roomId)?.size === 0) {
      this.connectedUsers.delete(roomId);
    }

    // Update user info - mantém o usuário mas remove a sala
    this.userInfo.set(userId, {
      ...userInfo,
      room_id: null,
    });

    // Leave socket.io room
    await socket.leave(roomId);

    // Update database
    await db.tx(async t => {
      // Update user's room to null
      await t.none(
        `
        UPDATE anonymous_users
        SET map_room_uuid = NULL,
            last_seen_at = NOW()
        WHERE id = $1
        `,
        [userId],
      );

      // Log activity
      await t.none(
        `
        INSERT INTO activity_logs (map_room_uuid, activity_type, user_id, user_name)
        VALUES ($1, $2, $3, $4)
      `,
        [roomId, 'USER_LEFT', userId, userInfo.display_name],
      );
    });

    logger.info('User removed from room', {
      userId,
      roomId,
      displayName: userInfo.display_name,
    });
  }

  getUserRoom(userId: string): string | null {
    return this.userInfo.get(userId)?.room_id || null;
  }

  getUserInfo(userId: string): UserPublicInfo | undefined {
    const info = this.userInfo.get(userId);
    if (!info) return undefined;

    return {
      display_name: info.display_name,
      room_id: info.room_id,
    };
  }

  async getRoomState(roomId: string) {
    try {
      const [users, comments, cursors] = await Promise.all([
        // Get active users
        db.any(
          `
          SELECT 
            id,
            display_name,
            joined_at as "joined_at"
          FROM anonymous_users
          WHERE map_room_uuid = $1
            AND last_seen_at > NOW() - INTERVAL '5 minutes'
        `,
          [roomId],
        ),

        // Get comments with replies
        db.any(
          `
          SELECT 
            c.*,
            ST_AsGeoJSON(c.location)::json as location,
            (
              SELECT json_agg(r.*)
              FROM comment_replies r
              WHERE r.comment_id = c.id
            ) as replies
          FROM spatial_comments c
          WHERE c.map_room_uuid = $1
        `,
          [roomId],
        ),

        // Get cursor positions
        db.any(
          `
          SELECT 
            user_id,
            ST_AsGeoJSON(location)::json as location,
            updated_at
          FROM cursor_positions
          WHERE map_room_uuid = $1
            AND updated_at > NOW() - INTERVAL '1 minute'
        `,
          [roomId],
        ),
      ]);

      return {
        users,
        comments,
        cursors: cursors.map(c => ({
          ...c,
          timestamp: new Date(c.updated_at).getTime(),
        })),
      };
    } catch (error) {
      logger.error('Error getting room state:', error);
      throw error;
    }
  }

  getRoomUsers(roomId: string): { user_id: string; display_name: string }[] {
    const users = this.connectedUsers.get(roomId) || new Set();
    return Array.from(users).map(userId => {
      const info = this.userInfo.get(userId);
      return {
        user_id: userId,
        display_name: info?.display_name || 'Unknown User',
      };
    });
  }

  getUserSocket(userId: string): Socket | undefined {
    return this.userInfo.get(userId)?.socket;
  }
}
