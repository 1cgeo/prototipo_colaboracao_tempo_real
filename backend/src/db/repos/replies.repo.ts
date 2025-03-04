// Path: db\repos\replies.repo.ts
import { IDatabase } from 'pg-promise';
import { Reply } from '../../types/index.js';

export class RepliesRepository {
  private db: IDatabase<any>;

  constructor(db: IDatabase<any>) {
    this.db = db;
  }

  async createReply(data: {
    comment_id: number;
    user_id: string;
    user_name: string;
    content: string;
  }): Promise<Reply> {
    return this.db.one(
      `INSERT INTO replies 
       (comment_id, user_id, user_name, content) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [data.comment_id, data.user_id, data.user_name, data.content],
    );
  }

  async getReply(id: number): Promise<Reply | null> {
    return this.db.oneOrNone('SELECT * FROM replies WHERE id = $1', id);
  }

  async updateReply(id: number, content: string): Promise<Reply | null> {
    return this.db.oneOrNone(
      `UPDATE replies 
       SET content = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [content, id],
    );
  }

  async deleteReply(id: number): Promise<boolean> {
    const result = await this.db.result(
      'DELETE FROM replies WHERE id = $1',
      id,
    );
    return result.rowCount > 0;
  }

  async getCommentMapId(commentId: number): Promise<number> {
    const result = await this.db.one(
      'SELECT map_id FROM comments WHERE id = $1',
      commentId,
    );
    return result.map_id;
  }
}
