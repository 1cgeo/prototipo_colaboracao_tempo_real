// Path: db\repos\maps.repo.ts
import { IDatabase } from 'pg-promise';
import { Map } from '../../types/index.js';

export class MapsRepository {
  private db: IDatabase<any>;

  constructor(db: IDatabase<any>) {
    this.db = db;
  }

  async getMaps(): Promise<Map[]> {
    return this.db.any('SELECT * FROM maps ORDER BY created_at DESC');
  }

  async getMap(id: number): Promise<Map | null> {
    return this.db.oneOrNone('SELECT * FROM maps WHERE id = $1', id);
  }

  async createMap(name: string, description: string | null): Promise<Map> {
    return this.db.one(
      'INSERT INTO maps (name, description) VALUES ($1, $2) RETURNING *',
      [name, description],
    );
  }

  async updateMap(
    id: number,
    name: string,
    description: string | null,
  ): Promise<Map | null> {
    return this.db.oneOrNone(
      'UPDATE maps SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id],
    );
  }

  async deleteMap(id: number): Promise<boolean> {
    const result = await this.db.result('DELETE FROM maps WHERE id = $1', id);
    return result.rowCount > 0;
  }
}
