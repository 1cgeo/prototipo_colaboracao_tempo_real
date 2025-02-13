import { z } from 'zod';

// Base schemas for request validation
const PointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

export type Point = z.infer<typeof PointSchema>;

// Request type for creating map rooms
export const CreateMapRoomRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export type CreateMapRoomRequest = z.infer<typeof CreateMapRoomRequestSchema>;

// Request types for comments
export const CreateCommentRequestSchema = z.object({
  content: z.string().min(1),
  location: PointSchema,
  comment_id: z.string().uuid().optional(),
});

export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

export const UpdateCommentRequestSchema = z.object({
  content: z.string().min(1),
  version: z.number().int().min(1),
  comment_id: z.string().uuid(),
});

export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequestSchema>;

// Request types for replies
export const CreateReplyRequestSchema = z.object({
  content: z.string().min(1),
  comment_id: z.string().uuid(),
});

export type CreateReplyRequest = z.infer<typeof CreateReplyRequestSchema>;

export const UpdateReplyRequestSchema = z.object({
  content: z.string().min(1),
  version: z.number().int().min(1),
  reply_id: z.string().uuid(),
});

export type UpdateReplyRequest = z.infer<typeof UpdateReplyRequestSchema>;

// Activity types
export type ActivityType =
  | 'COMMENT_CREATED'
  | 'COMMENT_UPDATED'
  | 'COMMENT_DELETED'
  | 'REPLY_CREATED'
  | 'REPLY_UPDATED'
  | 'REPLY_DELETED'
  | 'USER_JOINED'
  | 'USER_LEFT';
