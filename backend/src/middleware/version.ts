import { Request, Response, NextFunction } from 'express';
import { db } from '../database/index.js';
import { APIError } from './error.js';
import logger from '../utils/logger.js';

interface VersionedEntity {
  version: number;
  id: string;
}

/**
 * Type guard to check if an object is a versioned entity
 */
function isVersionedEntity(obj: any): obj is VersionedEntity {
  return obj && typeof obj.version === 'number' && typeof obj.id === 'string';
}

/**
 * Middleware to handle version control for entities
 * @param table The database table name
 * @param idField The name of the ID field in the table
 */
export const versionControl = (table: string, idField: string = 'id') => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const entity = req.body;

      if (!isVersionedEntity(entity)) {
        throw new APIError(400, 'Version information is required');
      }

      // Check if version matches current version in database
      const current = await db.oneOrNone(
        `
        SELECT version 
        FROM ${table} 
        WHERE ${idField} = $1
        `,
        [entity.id],
      );

      if (!current) {
        throw new APIError(404, 'Entity not found');
      }

      if (current.version !== entity.version) {
        throw new APIError(
          409,
          'Version conflict: The entity has been modified by another user',
          'VERSION_CONFLICT',
          {
            currentVersion: current.version,
            providedVersion: entity.version,
          },
        );
      }

      // Increment version automatically
      entity.version += 1;
      next();
    } catch (error) {
      logger.error('Version control error:', error);
      next(error);
    }
  };
};
