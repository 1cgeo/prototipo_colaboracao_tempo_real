import { Socket } from 'socket.io';
import { db } from '../database/index.js';
import logger from '../utils/logger.js';

interface UserInfo {
  displayName: string;
  roomId: string;
  socket: Socket;
}

export interface UserPublicInfo {
  displayName: string;
  roomId: string;
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
    this.userInfo.set(userId, { displayName, roomId, socket });

    // Join socket.io room
    await socket.join(roomId);

    // Update database
    await db.tx(async t => {
      // Add/update user
      await t.none(
        `
        INSERT INTO anonymous_users (id, display_name, map_room_uuid, joined_at, last_seen_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET last_seen_at = NOW()
      `,
        [userId, displayName, roomId],
      );

      // Log activity
      await t.none(
        `
        INSERT INTO activity_logs (map_room_uuid, activity_type, user_id, user_name)
        VALUES ($1, $2, $3, $4)
      `,
        [roomId, 'USER_JOINED', userId, displayName],
      );

      // Update room active users count
      await t.none(
        `
        UPDATE map_rooms
        SET active_users_count = active_users_count + 1
        WHERE uuid = $1
      `,
        [roomId],
      );
    });
  }

  async removeUserFromRoom(socket: Socket, userId: string) {
    const userInfo = this.userInfo.get(userId);
    if (!userInfo) return;

    const { roomId, displayName } = userInfo;

    // Remove from room state
    this.connectedUsers.get(roomId)?.delete(userId);
    if (this.connectedUsers.get(roomId)?.size === 0) {
      this.connectedUsers.delete(roomId);
    }

    // Remove user info
    this.userInfo.delete(userId);

    // Leave socket.io room
    await socket.leave(roomId);

    // Update database
    await db.tx(async t => {
      // Update user last seen
      await t.none(
        `
        UPDATE anonymous_users
        SET last_seen_at = NOW()
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
        [roomId, 'USER_LEFT', userId, displayName],
      );

      // Update room active users count
      await t.none(
        `
        UPDATE map_rooms
        SET active_users_count = GREATEST(0, active_users_count - 1)
        WHERE uuid = $1
      `,
        [roomId],
      );
    });
  }

  getUserRoom(userId: string): string | undefined {
    return this.userInfo.get(userId)?.roomId;
  }

  getUserInfo(userId: string): UserPublicInfo | undefined {
    const info = this.userInfo.get(userId);
    if (!info) return undefined;
    const publicInfo: UserPublicInfo = {
      displayName: info.displayName,
      roomId: info.roomId,
    };
    return publicInfo;
  }

  async getRoomState(roomId: string) {
    try {
      const [users, comments, cursors] = await Promise.all([
        // Get active users
        db.any(
          `
          SELECT id, display_name
          FROM anonymous_users
          WHERE map_room_uuid = $1
            AND last_seen_at > NOW() - INTERVAL '5 minutes'
        `,
          [roomId],
        ),

        // Get comments with replies
        db.any(
          `
          SELECT c.*, 
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
          SELECT user_id, ST_AsGeoJSON(location) as location
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
        cursors,
      };
    } catch (error) {
      logger.error('Error getting room state:', error);
      throw error;
    }
  }

  getRoomUsers(roomId: string): { userId: string; displayName: string }[] {
    const users = this.connectedUsers.get(roomId) || new Set();
    return Array.from(users).map(userId => {
      const info = this.userInfo.get(userId);
      return {
        userId,
        displayName: info?.displayName || 'Unknown User',
      };
    });
  }

  getUserSocket(userId: string): Socket | undefined {
    return this.userInfo.get(userId)?.socket;
  }
}
