// src/db/repos/index.ts
import { IDatabase } from 'pg-promise';
import { MapsRepository } from './maps.repo.js';
import { CommentsRepository } from './comments.repo.js';
import { RepliesRepository } from './replies.repo.js';

// This function initializes all repositories and attaches them to the database object
export function initRepositories(db: IDatabase<any>): void {
  // Create a new instance of repositories, extending the database protocol
  Object.assign(db, {
    ...new MapsRepository(db),
    ...new CommentsRepository(db),
    ...new RepliesRepository(db),
  });
}
