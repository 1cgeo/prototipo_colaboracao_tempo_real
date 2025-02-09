import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { APIError } from './error.js';
import logger from '../utils/logger.js';

const validateRequest = (
  schema: z.ZodSchema,
  location: 'body' | 'query' | 'params' = 'body',
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = await schema.parseAsync(req[location]);
      req[location] = data;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation error', {
          path: req.path,
          errors: error.errors,
        });
        next(
          new APIError(
            400,
            'Validation failed',
            'VALIDATION_ERROR',
            error.errors,
          ),
        );
      } else {
        next(error);
      }
    }
  };
};

/**
 * UUID parameter validation
 */
export const validateUUID = validateRequest(
  z.object({
    uuid: z.string().uuid(),
  }),
  'params',
);

/**
 * Spatial bounds validation
 */
export const validateBounds = validateRequest(
  z.object({
    ne: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    sw: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  }),
  'query',
);

/**
 * Version validation for comment operations
 */
export const validateVersion = validateRequest(
  z.object({
    version: z.number().int().positive(),
  }),
);

/**
 * Pagination parameters validation
 */
export const validatePagination = validateRequest(
  z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    before: z.string().datetime().optional(),
  }),
  'query',
);

/**
 * Map room request validation schemas
 */
export const mapRoomValidations = {
  create: validateRequest(
    z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    }),
  ),
  update: validateRequest(
    z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    }),
  ),
};

/**
 * Comment request validation schemas
 */
export const commentValidations = {
  create: validateRequest(
    z.object({
      content: z.string().min(1),
      location: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
        ]),
      }),
    }),
  ),
  update: validateRequest(
    z.object({
      content: z.string().min(1),
      version: z.number().int().positive(),
    }),
  ),
  reply: validateRequest(
    z.object({
      content: z.string().min(1),
    }),
  ),
};
