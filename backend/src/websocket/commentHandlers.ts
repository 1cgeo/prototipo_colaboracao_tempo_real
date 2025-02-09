import { Socket } from 'socket.io';
import { WebSocketState } from './state.js';
import {
  CreateCommentRequestSchema,
  UpdateCommentRequestSchema,
  CreateReplyRequestSchema,
  UpdateReplyRequestSchema,
} from '../types/index.js';
import { CommentService } from '../services/commentService.js';
import { ActivityService } from '../services/activityService.js';
import logger from '../utils/logger.js';
import { APIError } from '../middleware/error.js';

const commentService = new CommentService();
const activityService = new ActivityService();

export const handleCommentCreate = async (
  socket: Socket,
  userId: string,
  displayName: string,
  data: unknown,
  state: WebSocketState,
) => {
  try {
    const { location, content } = CreateCommentRequestSchema.parse(data);
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to create comment without being in a room', {
        userId,
      });
      return;
    }

    const comment = await commentService.createComment(
      roomId,
      userId,
      displayName,
      {
        content,
        location,
      },
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'COMMENT_CREATED',
      userId,
      displayName,
      {
        commentId: comment.id,
        location,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('comment:created', {
      ...comment,
      replies: [],
    });
  } catch (error) {
    logger.error('Error creating comment:', error);
    socket.emit('error', { message: 'Failed to create comment' });
  }
};

export const handleCommentUpdate = async (
  socket: Socket,
  userId: string,
  data: unknown,
  state: WebSocketState,
) => {
  try {
    const { content, version, commentId } =
      UpdateCommentRequestSchema.parse(data);
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to update comment without being in a room', {
        userId,
      });
      return;
    }

    const comment = await commentService.updateComment(
      roomId,
      commentId,
      userId,
      {
        content,
        version,
        commentId,
      },
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'COMMENT_UPDATED',
      userId,
      state.getUserInfo(userId)?.displayName || 'Unknown User',
      {
        commentId,
        newVersion: version + 1,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('comment:updated', comment);
  } catch (error) {
    logger.error('Error updating comment:', error);
    socket.emit('error', {
      message:
        error instanceof APIError ? error.message : 'Failed to update comment',
    });
  }
};

export const handleCommentDelete = async (
  socket: Socket,
  userId: string,
  data: { commentId: string; version: number },
  state: WebSocketState,
) => {
  try {
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to delete comment without being in a room', {
        userId,
      });
      return;
    }

    await commentService.deleteComment(
      roomId,
      data.commentId,
      userId,
      data.version,
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'COMMENT_DELETED',
      userId,
      state.getUserInfo(userId)?.displayName || 'Unknown User',
      {
        commentId: data.commentId,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('comment:deleted', {
      commentId: data.commentId,
    });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    socket.emit('error', {
      message:
        error instanceof APIError ? error.message : 'Failed to delete comment',
    });
  }
};

export const handleReplyCreate = async (
  socket: Socket,
  userId: string,
  displayName: string,
  data: unknown,
  state: WebSocketState,
) => {
  try {
    const { content, commentId } = CreateReplyRequestSchema.parse(data);
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to create reply without being in a room', {
        userId,
      });
      return;
    }

    const reply = await commentService.createReply(
      roomId,
      commentId,
      userId,
      displayName,
      { content, commentId },
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'REPLY_CREATED',
      userId,
      displayName,
      {
        commentId,
        replyId: reply.id,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('reply:created', {
      commentId,
      reply,
    });
  } catch (error) {
    logger.error('Error creating reply:', error);
    socket.emit('error', { message: 'Failed to create reply' });
  }
};

export const handleReplyUpdate = async (
  socket: Socket,
  userId: string,
  data: unknown,
  state: WebSocketState,
) => {
  try {
    const { content, version, replyId } = UpdateReplyRequestSchema.parse(data);
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to update reply without being in a room', {
        userId,
      });
      return;
    }

    const reply = await commentService.updateReply(roomId, replyId, userId, {
      content,
      version,
      replyId,
    });

    // Track activity
    await activityService.logActivity(
      roomId,
      'REPLY_UPDATED',
      userId,
      state.getUserInfo(userId)?.displayName || 'Unknown User',
      {
        replyId,
        newVersion: version + 1,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('reply:updated', reply);
  } catch (error) {
    logger.error('Error updating reply:', error);
    socket.emit('error', {
      message:
        error instanceof APIError ? error.message : 'Failed to update reply',
    });
  }
};

export const handleReplyDelete = async (
  socket: Socket,
  userId: string,
  data: { replyId: string; version: number },
  state: WebSocketState,
) => {
  try {
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to delete reply without being in a room', {
        userId,
      });
      return;
    }

    await commentService.deleteReply(
      roomId,
      data.replyId,
      userId,
      data.version,
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'REPLY_DELETED',
      userId,
      state.getUserInfo(userId)?.displayName || 'Unknown User',
      {
        replyId: data.replyId,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('reply:deleted', {
      replyId: data.replyId,
    });
  } catch (error) {
    logger.error('Error deleting reply:', error);
    socket.emit('error', {
      message:
        error instanceof APIError ? error.message : 'Failed to delete reply',
    });
  }
};
