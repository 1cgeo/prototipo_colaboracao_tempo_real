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
        user_id: userId,
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
        comment_id: comment.id,
        location,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('comment:created', {
      id: comment.id,
      user_id: userId,
      room_id: roomId,
      content,
      location,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error creating comment:', error);
    socket.emit('error', {
      code: 'COMMENT_CREATE_ERROR',
      message: 'Failed to create comment',
    });
  }
};

export const handleCommentUpdate = async (
  socket: Socket,
  userId: string,
  data: unknown,
  state: WebSocketState,
) => {
  try {
    const validatedData = UpdateCommentRequestSchema.parse(data);
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to update comment without being in a room', {
        user_id: userId,
      });
      return;
    }

    const comment = await commentService.updateComment(
      roomId,
      validatedData.comment_id,
      userId,
      validatedData,
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'COMMENT_UPDATED',
      userId,
      state.getUserInfo(userId)?.display_name || 'Unknown User',
      {
        comment_id: validatedData.comment_id,
        new_version: validatedData.version + 1,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('comment:updated', {
      comment_id: validatedData.comment_id,
      user_id: userId,
      room_id: roomId,
      content: validatedData.content,
      version: comment.version,
      updated_at: comment.updated_at,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error updating comment:', error);
    socket.emit('error', {
      code: 'COMMENT_UPDATE_ERROR',
      message:
        error instanceof APIError ? error.message : 'Failed to update comment',
    });
  }
};

export const handleCommentDelete = async (
  socket: Socket,
  userId: string,
  data: { comment_id: string; version: number },
  state: WebSocketState,
) => {
  try {
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to delete comment without being in a room', {
        user_id: userId,
      });
      return;
    }

    await commentService.deleteComment(
      roomId,
      data.comment_id,
      userId,
      data.version,
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'COMMENT_DELETED',
      userId,
      state.getUserInfo(userId)?.display_name || 'Unknown User',
      {
        comment_id: data.comment_id,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('comment:deleted', {
      comment_id: data.comment_id,
      user_id: userId,
      room_id: roomId,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    socket.emit('error', {
      code: 'COMMENT_DELETE_ERROR',
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
    const validatedData = CreateReplyRequestSchema.parse(data);
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to create reply without being in a room', {
        user_id: userId,
      });
      return;
    }

    const reply = await commentService.createReply(
      roomId,
      validatedData.comment_id,
      userId,
      displayName,
      validatedData,
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'REPLY_CREATED',
      userId,
      displayName,
      {
        comment_id: validatedData.comment_id,
        reply_id: reply.id,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('reply:created', {
      id: reply.id,
      comment_id: validatedData.comment_id,
      user_id: userId,
      room_id: roomId,
      content: validatedData.content,
      created_at: reply.created_at,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error creating reply:', error);
    socket.emit('error', {
      code: 'REPLY_CREATE_ERROR',
      message: 'Failed to create reply',
    });
  }
};

export const handleReplyUpdate = async (
  socket: Socket,
  userId: string,
  data: unknown,
  state: WebSocketState,
) => {
  try {
    const validatedData = UpdateReplyRequestSchema.parse(data);
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to update reply without being in a room', {
        user_id: userId,
      });
      return;
    }

    const reply = await commentService.updateReply(
      roomId,
      validatedData.reply_id,
      userId,
      validatedData,
    );

    // Track activity
    await activityService.logActivity(
      roomId,
      'REPLY_UPDATED',
      userId,
      state.getUserInfo(userId)?.display_name || 'Unknown User',
      {
        reply_id: validatedData.reply_id,
        new_version: validatedData.version + 1,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('reply:updated', {
      reply_id: validatedData.reply_id,
      user_id: userId,
      room_id: roomId,
      content: validatedData.content,
      version: reply.version,
      updated_at: reply.updated_at,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error updating reply:', error);
    socket.emit('error', {
      code: 'REPLY_UPDATE_ERROR',
      message:
        error instanceof APIError ? error.message : 'Failed to update reply',
    });
  }
};

export const handleReplyDelete = async (
  socket: Socket,
  userId: string,
  data: { reply_id: string; version: number },
  state: WebSocketState,
) => {
  try {
    const roomId = state.getUserRoom(userId);

    if (!roomId) {
      logger.warn('User tried to delete reply without being in a room', {
        user_id: userId,
      });
      return;
    }

    const { reply_id, version } = data;
    await commentService.deleteReply(roomId, reply_id, userId, version);

    // Track activity
    await activityService.logActivity(
      roomId,
      'REPLY_DELETED',
      userId,
      state.getUserInfo(userId)?.display_name || 'Unknown User',
      {
        reply_id,
      },
    );

    // Broadcast to room
    socket.to(roomId).emit('reply:deleted', {
      reply_id,
      user_id: userId,
      room_id: roomId,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error deleting reply:', error);
    socket.emit('error', {
      code: 'REPLY_DELETE_ERROR',
      message:
        error instanceof APIError ? error.message : 'Failed to delete reply',
    });
  }
};
