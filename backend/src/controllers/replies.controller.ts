// Path: controllers\replies.controller.ts
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
    console.log(`[API] Creating new reply for comment ${replyData.comment_id} by user ${replyData.user_id}`);

    // Validate required fields
    if (
      !replyData.comment_id ||
      !replyData.user_id ||
      !replyData.user_name ||
      !replyData.content
    ) {
      console.log('[API] Reply creation failed: Missing required fields');
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Use transaction to verify comment exists and create reply atomically
    const result = await db.tx('create-reply', async t => {
      // Check if parent comment exists by trying to get its map_id
      const commentCheck = await t.oneOrNone(
        'SELECT map_id FROM comments WHERE id = $1',
        replyData.comment_id
      );
      
      if (!commentCheck) {
        return { error: 'parent_not_found' };
      }
      
      // Create reply
      const newReply = await t.one(
        `INSERT INTO replies 
         (comment_id, user_id, user_name, content) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [
          replyData.comment_id,
          replyData.user_id,
          replyData.user_name,
          replyData.content,
        ]
      );
      
      return { 
        reply: newReply, 
        mapId: commentCheck.map_id 
      };
    });

    // Handle transaction results
    if (result.error === 'parent_not_found') {
      console.log(`[API] Reply creation failed: Parent comment ${replyData.comment_id} not found`);
      res.status(404).json({ error: 'Parent comment not found' });
      return;
    }

    const newReply = result.reply;
    const mapId = result.mapId;
    
    console.log(`[API] Reply created successfully with ID ${newReply.id}`);

    // Emit socket event
    const io = getIO();
    io.to(`map-${mapId}`).emit('reply-created', {
      reply: newReply,
      commentId: replyData.comment_id,
    });
    console.log(`[SOCKET] Emitted reply-created event for map ${mapId}`);

    res.status(201).json(newReply);
  } catch (error) {
    console.error('[API] Error creating reply:', error);
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
    
    console.log(`[API] Updating reply ${replyId} by user ${userId}`);

    // Validate content
    if (!updateData.content) {
      console.log('[API] Reply update failed: Content is required');
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    // Use transaction to check authorization and update reply
    const result = await db.tx('update-reply', async t => {
      // Check if user is the author
      const reply = await t.oneOrNone('SELECT * FROM replies WHERE id = $1', replyId);

      if (!reply) {
        console.log(`[API] Reply update failed: Reply ${replyId} not found`);
        return { error: 'not_found' };
      }

      if (reply.user_id !== userId) {
        console.log(`[API] Reply update failed: User ${userId} is not the author of reply ${replyId}`);
        return { error: 'unauthorized' };
      }

      // Update reply
      const updatedReply = await t.oneOrNone(
        `UPDATE replies 
         SET content = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [updateData.content, replyId]
      );

      if (!updatedReply) {
        return { error: 'update_failed' };
      }

      // Get map_id for socket event
      const comment = await t.one(
        'SELECT map_id FROM comments WHERE id = $1',
        updatedReply.comment_id
      );

      return { 
        reply: updatedReply, 
        mapId: comment.map_id 
      };
    });

    // Handle transaction results
    if (result.error === 'not_found') {
      res.status(404).json({ error: 'Reply not found' });
      return;
    }
    
    if (result.error === 'unauthorized') {
      res.status(403).json({ error: 'Only the author can update this reply' });
      return;
    }
    
    if (result.error === 'update_failed') {
      res.status(500).json({ error: 'Failed to update reply' });
      return;
    }

    const updatedReply = result.reply;
    const mapId = result.mapId;
    
    console.log(`[API] Reply ${replyId} updated successfully`);

    // Emit socket event
    const io = getIO();
    io.to(`map-${mapId}`).emit('reply-updated', {
      reply: updatedReply,
      commentId: updatedReply.comment_id,
    });
    console.log(`[SOCKET] Emitted reply-updated event for map ${mapId}`);

    res.json(updatedReply);
  } catch (error) {
    console.error('[API] Error updating reply:', error);
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
    
    console.log(`[API] Deleting reply ${replyId} by user ${userId}`);

    // Use transaction to check authorization and delete reply
    const result = await db.tx('delete-reply', async t => {
      // Check if user is the author
      const reply = await t.oneOrNone('SELECT * FROM replies WHERE id = $1', replyId);

      if (!reply) {
        console.log(`[API] Reply deletion failed: Reply ${replyId} not found`);
        return { error: 'not_found' };
      }

      if (reply.user_id !== userId) {
        console.log(`[API] Reply deletion failed: User ${userId} is not the author of reply ${replyId}`);
        return { error: 'unauthorized' };
      }

      // Get info needed for socket event before deleting
      const commentId = reply.comment_id;
      const comment = await t.one(
        'SELECT map_id FROM comments WHERE id = $1',
        commentId
      );
      const mapId = comment.map_id;

      // Delete reply
      const result = await t.result('DELETE FROM replies WHERE id = $1', replyId);
      const deleted = result.rowCount > 0;

      if (!deleted) {
        return { error: 'delete_failed' };
      }

      return { 
        success: true, 
        mapId, 
        commentId 
      };
    });

    // Handle transaction results
    if (result.error === 'not_found') {
      res.status(404).json({ error: 'Reply not found' });
      return;
    }
    
    if (result.error === 'unauthorized') {
      res.status(403).json({ error: 'Only the author can delete this reply' });
      return;
    }
    
    if (result.error === 'delete_failed') {
      res.status(500).json({ error: 'Failed to delete reply' });
      return;
    }

    console.log(`[API] Reply ${replyId} deleted successfully`);

    // Emit socket event
    const io = getIO();
    io.to(`map-${result.mapId}`).emit('reply-deleted', {
      replyId,
      commentId: result.commentId,
    });
    console.log(`[SOCKET] Emitted reply-deleted event for map ${result.mapId}`);

    res.status(204).send();
  } catch (error) {
    console.error('[API] Error deleting reply:', error);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
};