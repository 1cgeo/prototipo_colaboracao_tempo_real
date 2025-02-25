// src/controllers/replies.controller.ts
import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { getIO } from '../services/socket.service.js';
import { ReplyCreateData, ReplyUpdateData } from '../types/index.js';

export const createReply = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const replyData: ReplyCreateData = req.body;

    // Validate required fields
    if (
      !replyData.comment_id ||
      !replyData.user_id ||
      !replyData.user_name ||
      !replyData.content
    ) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check if parent comment exists by trying to get its map_id
    try {
      await db.getCommentMapId(replyData.comment_id);
    } catch (error) {
      res.status(404).json({ error: 'Parent comment not found' });
      return;
    }

    // Create reply
    const newReply = await db.createReply({
      comment_id: replyData.comment_id,
      user_id: replyData.user_id,
      user_name: replyData.user_name,
      content: replyData.content,
    });

    // Get map ID for socket event
    const mapId = await db.getCommentMapId(replyData.comment_id);

    // Emit socket event
    const io = getIO();
    io.to(`map-${mapId}`).emit('reply-created', {
      reply: newReply,
      commentId: replyData.comment_id,
    });

    res.status(201).json(newReply);
  } catch (error) {
    console.error('Error creating reply:', error);
    res.status(500).json({ error: 'Failed to create reply' });
  }
};

export const updateReply = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const replyId = parseInt(req.params.id, 10);
    const updateData: ReplyUpdateData = req.body;
    const userId = req.query.userId as string;

    // Validate content
    if (!updateData.content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    // Check if user is the author
    const reply = await db.getReply(replyId);

    if (!reply) {
      res.status(404).json({ error: 'Reply not found' });
      return;
    }

    if (reply.user_id !== userId) {
      res.status(403).json({ error: 'Only the author can update this reply' });
      return;
    }

    // Update reply
    const updatedReply = await db.updateReply(replyId, updateData.content);

    if (!updatedReply) {
      res.status(500).json({ error: 'Failed to update reply' });
      return;
    }

    // Get map_id for socket event
    const mapId = await db.getCommentMapId(updatedReply.comment_id);

    // Emit socket event
    const io = getIO();
    io.to(`map-${mapId}`).emit('reply-updated', {
      reply: updatedReply,
      commentId: updatedReply.comment_id,
    });

    res.json(updatedReply);
  } catch (error) {
    console.error('Error updating reply:', error);
    res.status(500).json({ error: 'Failed to update reply' });
  }
};

export const deleteReply = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const replyId = parseInt(req.params.id, 10);
    const userId = req.query.userId as string;

    // Check if user is the author
    const reply = await db.getReply(replyId);

    if (!reply) {
      res.status(404).json({ error: 'Reply not found' });
      return;
    }

    if (reply.user_id !== userId) {
      res.status(403).json({ error: 'Only the author can delete this reply' });
      return;
    }

    // Get map_id and comment_id before deleting
    const commentId = reply.comment_id;
    const mapId = await db.getCommentMapId(commentId);

    // Delete reply
    const deleted = await db.deleteReply(replyId);

    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete reply' });
      return;
    }

    // Emit socket event
    const io = getIO();
    io.to(`map-${mapId}`).emit('reply-deleted', {
      replyId,
      commentId,
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
};
