import { db } from '../database/index.js';
import { APIError } from '../middleware/error.js';
import {
  CreateCommentRequest,
  UpdateCommentRequest,
  CreateReplyRequest,
  UpdateReplyRequest,
  Point,
} from '../types/index.js';
import logger from '../utils/logger.js';

export class CommentService {
  /**
   * List comments with spatial optimization and pagination
   */
  async listComments(
    roomId: string,
    bounds?: { ne: Point; sw: Point },
    limit = 100,
  ) {
    const query = bounds
      ? `
      WITH RECURSIVE comment_tree AS (
        SELECT 
          c.*,
          ST_AsGeoJSON(c.location)::json as location
        FROM spatial_comments c
        WHERE c.map_room_uuid = $1
          AND c.location && ST_MakeEnvelope($2, $3, $4, $5, 4326)
        LIMIT $6
      )
      SELECT 
        c.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', r.id,
              'content', r.content,
              'authorId', r.author_id,
              'authorName', r.author_name,
              'version', r.version,
              'createdAt', r.created_at,
              'updatedAt', r.updated_at
            ) ORDER BY r.created_at
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as replies
      FROM comment_tree c
      LEFT JOIN comment_replies r ON c.id = r.comment_id
      GROUP BY c.id, c.content, c.location, c.author_id, c.author_name, 
               c.version, c.created_at, c.updated_at
      ORDER BY c.created_at DESC
    `
      : `
      SELECT 
        c.*,
        ST_AsGeoJSON(c.location)::json as location,
        COALESCE(
          json_agg(
            json_build_object(
              'id', r.id,
              'content', r.content,
              'authorId', r.author_id,
              'authorName', r.author_name,
              'version', r.version,
              'createdAt', r.created_at,
              'updatedAt', r.updated_at
            ) ORDER BY r.created_at
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as replies
      FROM spatial_comments c
      LEFT JOIN comment_replies r ON c.id = r.comment_id
      WHERE c.map_room_uuid = $1
      GROUP BY c.id, c.content, c.location, c.author_id, c.author_name,
               c.version, c.created_at, c.updated_at
      ORDER BY c.created_at DESC
      LIMIT $2
    `;

    const params = bounds
      ? [
          roomId,
          bounds.sw.coordinates[0],
          bounds.sw.coordinates[1],
          bounds.ne.coordinates[0],
          bounds.ne.coordinates[1],
          limit,
        ]
      : [roomId, limit];

    const comments = await db.any(query, params);

    logger.debug('Listed comments', {
      roomId,
      count: comments.length,
      hasBounds: !!bounds,
    });

    return comments;
  }

  /**
   * Create a new spatial comment
   */
  async createComment(
    roomId: string,
    userId: string,
    userName: string,
    data: CreateCommentRequest,
  ) {
    const comment = await db.one(
      `
      INSERT INTO spatial_comments (
        map_room_uuid,
        location,
        content,
        author_id,
        author_name,
        version
      )
      VALUES (
        $1,
        ST_SetSRID(ST_MakePoint($2, $3), 4326),
        $4,
        $5,
        $6,
        1
      )
      RETURNING *, ST_AsGeoJSON(location)::json as location
    `,
      [
        roomId,
        data.location.coordinates[0],
        data.location.coordinates[1],
        data.content,
        userId,
        userName,
      ],
    );

    logger.info('Created new comment', {
      roomId,
      commentId: comment.id,
      location: data.location,
    });

    return comment;
  }

  /**
   * Update a comment with version control
   */
  async updateComment(
    roomId: string,
    commentId: string,
    userId: string,
    data: UpdateCommentRequest,
  ) {
    const comment = await db.oneOrNone(
      `
      UPDATE spatial_comments
      SET 
        content = $1,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $2 
        AND map_room_uuid = $3
        AND version = $4
        AND author_id = $5
      RETURNING *, ST_AsGeoJSON(location)::json as location
    `,
      [data.content, commentId, roomId, data.version, userId],
    );

    if (!comment) {
      throw new APIError(409, 'Comment version mismatch or not found');
    }

    logger.info('Updated comment', {
      roomId,
      commentId,
      newVersion: comment.version,
    });

    return comment;
  }

  /**
   * Delete a comment with version control
   */
  async deleteComment(
    roomId: string,
    commentId: string,
    userId: string,
    version: number,
  ) {
    const result = await db.result(
      `
      DELETE FROM spatial_comments
      WHERE id = $1 
        AND map_room_uuid = $2
        AND version = $3
        AND author_id = $4
    `,
      [commentId, roomId, version, userId],
    );

    if (result.rowCount === 0) {
      throw new APIError(409, 'Comment version mismatch or not found');
    }

    logger.info('Deleted comment', { roomId, commentId });
    return true;
  }

  /**
   * Create a reply to a comment
   */
  async createReply(
    roomId: string,
    commentId: string,
    userId: string,
    userName: string,
    data: CreateReplyRequest,
  ) {
    const reply = await db.one(
      `
      INSERT INTO comment_replies (
        comment_id,
        content,
        author_id,
        author_name,
        version
      )
      VALUES ($1, $2, $3, $4, 1)
      RETURNING *
    `,
      [commentId, data.content, userId, userName],
    );

    logger.info('Created new reply', {
      roomId,
      commentId,
      replyId: reply.id,
    });

    return reply;
  }

  /**
   * Update a reply with version control
   */
  async updateReply(
    roomId: string,
    replyId: string,
    userId: string,
    data: UpdateReplyRequest,
  ) {
    const reply = await db.oneOrNone(
      `
      UPDATE comment_replies
      SET 
        content = $1,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $2 
        AND version = $3
        AND author_id = $4
        AND comment_id IN (
          SELECT id FROM spatial_comments WHERE map_room_uuid = $5
        )
      RETURNING *
    `,
      [data.content, replyId, data.version, userId, roomId],
    );

    if (!reply) {
      throw new APIError(409, 'Reply version mismatch or not found');
    }

    logger.info('Updated reply', {
      roomId,
      replyId,
      newVersion: reply.version,
    });

    return reply;
  }

  /**
   * Delete a reply with version control
   */
  async deleteReply(
    roomId: string,
    replyId: string,
    userId: string,
    version: number,
  ) {
    const result = await db.result(
      `
      DELETE FROM comment_replies
      WHERE id = $1 
        AND version = $2
        AND author_id = $3
        AND comment_id IN (
          SELECT id FROM spatial_comments WHERE map_room_uuid = $4
        )
    `,
      [replyId, version, userId, roomId],
    );

    if (result.rowCount === 0) {
      throw new APIError(409, 'Reply version mismatch or not found');
    }

    logger.info('Deleted reply', { roomId, replyId });
    return true;
  }
}
