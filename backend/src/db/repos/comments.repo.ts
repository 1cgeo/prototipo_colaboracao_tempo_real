// Path: db\repos\comments.repo.ts
import { IDatabase } from 'pg-promise';
import { Comment, Reply } from '../../types/index.js';

export class CommentsRepository {
  private db: IDatabase<any>;

  constructor(db: IDatabase<any>) {
    this.db = db;
  }

  async getMapComments(mapId: number): Promise<Comment[]> {
    return this.db.any(
      'SELECT * FROM comments WHERE map_id = $1 ORDER BY created_at DESC',
      mapId,
    );
  }

  async getCommentReplies(commentId: string): Promise<Reply[]> {
    return this.db.any(
      'SELECT * FROM replies WHERE comment_id = $1 ORDER BY created_at ASC',
      commentId,
    );
  }

  async createComment(data: {
    map_id: number;
    user_id: string;
    user_name: string;
    content: string;
    lng: number;
    lat: number;
    client_id?: string;
    offline_created?: boolean;
  }): Promise<Comment> {
    return this.db.one(
      `INSERT INTO comments 
       (map_id, user_id, user_name, content, lng, lat, client_id, offline_created) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        data.map_id,
        data.user_id,
        data.user_name,
        data.content,
        data.lng,
        data.lat,
        data.client_id || null,
        data.offline_created || false
      ],
    );
  }

  async getComment(id: string): Promise<Comment | null> {
    return this.db.oneOrNone('SELECT * FROM comments WHERE id = $1', id);
  }

  async getCommentByClientId(clientId: string, mapId: number): Promise<Comment | null> {
    return this.db.oneOrNone(
      'SELECT * FROM comments WHERE client_id = $1 AND map_id = $2',
      [clientId, mapId]
    );
  }

  async updateComment(id: string, content: string): Promise<Comment | null> {
    return this.db.oneOrNone(
      `UPDATE comments 
       SET content = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [content, id],
    );
  }

  async updateCommentPosition(
    id: string,
    lng: number,
    lat: number,
  ): Promise<Comment | null> {
    return this.db.oneOrNone(
      `UPDATE comments 
       SET lng = $1, lat = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING *`,
      [lng, lat, id],
    );
  }

  async deleteComment(id: string): Promise<boolean> {
    const result = await this.db.result(
      'DELETE FROM comments WHERE id = $1',
      id,
    );
    return result.rowCount > 0;
  }

  // Get comments updated since a timestamp
  async getUpdatedComments(
    mapId: number,
    since: number,
    page: number = 1,
    limit: number = 100
  ): Promise<Comment[]> {
    const offset = (page - 1) * limit;
    
    // Get comments
    const comments = await this.db.any(
      `SELECT * FROM comments 
       WHERE map_id = $1 AND updated_at > to_timestamp($2/1000.0)
       ORDER BY updated_at ASC
       LIMIT $3 OFFSET $4`,
      [mapId, since, limit, offset]
    );
    
    // Get replies for these comments
    for (const comment of comments) {
      comment.replies = await this.getUpdatedRepliesForComment(comment.id, since);
    }
    
    return comments;
  }

  // Get updated replies for a comment
  async getUpdatedRepliesForComment(
    commentId: string,
    since: number
  ): Promise<Reply[]> {
    return this.db.any(
      `SELECT * FROM replies
       WHERE comment_id = $1 AND updated_at > to_timestamp($2/1000.0)
       ORDER BY created_at ASC`,
      [commentId, since]
    );
  }

  // Get count of updated comments for pagination
  async getUpdatedCommentsCount(
    mapId: number,
    since: number
  ): Promise<number> {
    const result = await this.db.one(
      `SELECT COUNT(*) as count FROM comments
       WHERE map_id = $1 AND updated_at > to_timestamp($2/1000.0)`,
      [mapId, since]
    );
    return parseInt(result.count);
  }
}