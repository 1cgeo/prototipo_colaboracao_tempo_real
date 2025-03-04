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

  async getCommentReplies(commentId: number): Promise<Reply[]> {
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
  }): Promise<Comment> {
    return this.db.one(
      `INSERT INTO comments 
       (map_id, user_id, user_name, content, lng, lat) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        data.map_id,
        data.user_id,
        data.user_name,
        data.content,
        data.lng,
        data.lat,
      ],
    );
  }

  async getComment(id: number): Promise<Comment | null> {
    return this.db.oneOrNone('SELECT * FROM comments WHERE id = $1', id);
  }

  async updateComment(id: number, content: string): Promise<Comment | null> {
    return this.db.oneOrNone(
      `UPDATE comments 
       SET content = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [content, id],
    );
  }

  async updateCommentPosition(
    id: number,
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

  async deleteComment(id: number): Promise<boolean> {
    const result = await this.db.result(
      'DELETE FROM comments WHERE id = $1',
      id,
    );
    return result.rowCount > 0;
  }
}
