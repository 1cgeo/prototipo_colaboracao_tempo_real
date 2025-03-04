// Path: schemas\comment.schema.ts
import { z } from 'zod';

export const commentFormSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty')
});

export const replyFormSchema = z.object({
  content: z.string().min(1, 'Reply cannot be empty')
});

export type CommentFormSchema = z.infer<typeof commentFormSchema>;
export type ReplyFormSchema = z.infer<typeof replyFormSchema>;

export const commentPositionSchema = z.object({
  lng: z.number(),
  lat: z.number()
});

export type CommentPositionSchema = z.infer<typeof commentPositionSchema>;