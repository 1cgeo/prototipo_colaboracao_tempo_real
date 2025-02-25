// src/controllers/comments.controller.ts
import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { getIO } from '../services/socket.service.js';
import {
  CommentCreateData,
  CommentUpdateData,
  CommentPositionUpdateData,
} from '../types/index.js';

export const getMapComments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const mapId = parseInt(req.params.mapId, 10);

    // Get all comments for the map
    const comments = await db.getMapComments(mapId);

    // Get all replies for these comments
    for (const comment of comments) {
      comment.replies = await db.getCommentReplies(comment.id);
    }

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

export const createComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const commentData: CommentCreateData = req.body;

    // Validate required fields
    if (
      !commentData.map_id ||
      !commentData.user_id ||
      !commentData.user_name ||
      !commentData.content ||
      commentData.lng === undefined ||
      commentData.lat === undefined
    ) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Create comment
    const newComment = await db.createComment({
      map_id: commentData.map_id,
      user_id: commentData.user_id,
      user_name: commentData.user_name,
      content: commentData.content,
      lng: commentData.lng,
      lat: commentData.lat,
    });

    // Initialize empty replies array
    newComment.replies = [];

    // Emit socket event
    const io = getIO();
    io.to(`map-${commentData.map_id}`).emit('comment-created', newComment);

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
};

export const updateComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const commentId = parseInt(req.params.id, 10);
    const updateData: CommentUpdateData = req.body;
    const userId = req.query.userId as string;

    // Validate content
    if (!updateData.content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    // Check if user is the author
    const comment = await db.getComment(commentId);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.user_id !== userId) {
      res
        .status(403)
        .json({ error: 'Only the author can update this comment' });
      return;
    }

    // Update comment
    const updatedComment = await db.updateComment(
      commentId,
      updateData.content,
    );

    if (!updatedComment) {
      res.status(500).json({ error: 'Failed to update comment' });
      return;
    }

    // Get replies
    updatedComment.replies = await db.getCommentReplies(commentId);

    // Emit socket event
    const io = getIO();
    io.to(`map-${updatedComment.map_id}`).emit(
      'comment-updated',
      updatedComment,
    );

    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
};

export const updateCommentPosition = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const commentId = parseInt(req.params.id, 10);
    const positionData: CommentPositionUpdateData = req.body;
    const userId = req.query.userId as string;

    // Validate position
    if (positionData.lng === undefined || positionData.lat === undefined) {
      res.status(400).json({ error: 'Longitude and latitude are required' });
      return;
    }

    // Check if user is the author
    const comment = await db.getComment(commentId);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.user_id !== userId) {
      res.status(403).json({ error: 'Only the author can move this comment' });
      return;
    }

    // Update comment position
    const updatedComment = await db.updateCommentPosition(
      commentId,
      positionData.lng,
      positionData.lat,
    );

    if (!updatedComment) {
      res.status(500).json({ error: 'Failed to update comment position' });
      return;
    }

    // Get replies
    updatedComment.replies = await db.getCommentReplies(commentId);

    // Emit socket event
    const io = getIO();
    io.to(`map-${updatedComment.map_id}`).emit('comment-moved', updatedComment);

    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment position:', error);
    res.status(500).json({ error: 'Failed to update comment position' });
  }
};

export const deleteComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const commentId = parseInt(req.params.id, 10);
    const userId = req.query.userId as string;

    // Check if user is the author
    const comment = await db.getComment(commentId);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.user_id !== userId) {
      res
        .status(403)
        .json({ error: 'Only the author can delete this comment' });
      return;
    }

    // Get map ID before deleting for the socket event
    const mapId = comment.map_id;

    // Delete comment (will cascade to replies)
    const deleted = await db.deleteComment(commentId);

    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete comment' });
      return;
    }

    // Emit socket event
    const io = getIO();
    io.to(`map-${mapId}`).emit('comment-deleted', commentId);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};
