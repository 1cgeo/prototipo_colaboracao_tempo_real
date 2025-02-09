import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.js';
import {
  CreateCommentRequestSchema,
  UpdateCommentRequestSchema,
  CreateReplyRequestSchema,
} from '../types/index.js';
import logger from '../utils/logger.js';
import { CommentService } from '../services/commentService.js';

const commentService = new CommentService();

export const listComments = asyncHandler(
  async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const bounds = req.query.bounds
      ? JSON.parse(req.query.bounds as string)
      : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const comments = await commentService.listComments(roomId, bounds, limit);

    res.json({
      status: 'success',
      data: comments,
    });
  },
);

export const createComment = asyncHandler(
  async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const data = CreateCommentRequestSchema.parse(req.body);
    const { userId, userName } = req.body; // Set by auth middleware

    const comment = await commentService.createComment(
      roomId,
      userId,
      userName,
      data,
    );

    logger.info(`Created new comment: ${comment.id} in room: ${roomId}`);

    res.status(201).json({
      status: 'success',
      data: {
        ...comment,
        replies: [],
      },
    });
  },
);

export const updateComment = asyncHandler(
  async (req: Request, res: Response) => {
    const { roomId, commentId } = req.params;
    const data = UpdateCommentRequestSchema.parse(req.body);
    const { userId } = req.body; // Set by auth middleware

    const comment = await commentService.updateComment(
      roomId,
      commentId,
      userId,
      data,
    );

    logger.info(`Updated comment: ${commentId} in room: ${roomId}`);

    res.json({
      status: 'success',
      data: comment,
    });
  },
);

export const deleteComment = asyncHandler(
  async (req: Request, res: Response) => {
    const { roomId, commentId } = req.params;
    const { version, userId } = req.body; // userId set by auth middleware

    await commentService.deleteComment(roomId, commentId, userId, version);

    logger.info(`Deleted comment: ${commentId} from room: ${roomId}`);

    res.json({
      status: 'success',
      message: 'Comment deleted successfully',
    });
  },
);

export const createReply = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, commentId } = req.params;
  const data = CreateReplyRequestSchema.parse(req.body);
  const { userId, userName } = req.body; // Set by auth middleware

  const reply = await commentService.createReply(
    roomId,
    commentId,
    userId,
    userName,
    data,
  );

  logger.info(`Created new reply: ${reply.id} for comment: ${commentId}`);

  res.status(201).json({
    status: 'success',
    data: reply,
  });
});
