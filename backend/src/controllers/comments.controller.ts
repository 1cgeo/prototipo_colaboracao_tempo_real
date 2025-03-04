// Path: controllers\comments.controller.ts
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
    console.log(`[API] Fetching comments for map ${mapId}`);

    // Get all comments for the map
    const comments = await db.getMapComments(mapId);
    console.log(`[API] Found ${comments.length} comments for map ${mapId}`);

    // Get all replies for these comments
    for (const comment of comments) {
      comment.replies = await db.getCommentReplies(comment.id);
      console.log(`[API] Fetched ${comment.replies.length} replies for comment ${comment.id}`);
    }

    res.json(comments);
  } catch (error) {
    console.error('[API] Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

export const createComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const commentData: CommentCreateData = req.body;
    console.log(`[API] Creating new comment for map ${commentData.map_id} by user ${commentData.user_id}`);

    // Validate required fields
    if (
      !commentData.map_id ||
      !commentData.user_id ||
      !commentData.user_name ||
      !commentData.content ||
      commentData.lng === undefined ||
      commentData.lat === undefined
    ) {
      console.log('[API] Comment creation failed: Missing required fields');
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Create comment using a transaction
    const newComment = await db.tx('create-comment', async t => {
      // Create the comment
      const comment = await t.one(
        `INSERT INTO comments 
         (map_id, user_id, user_name, content, lng, lat) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          commentData.map_id,
          commentData.user_id,
          commentData.user_name,
          commentData.content,
          commentData.lng,
          commentData.lat,
        ]
      );
      
      return comment;
    });

    console.log(`[API] Comment created successfully with ID ${newComment.id}`);

    // Initialize empty replies array
    newComment.replies = [];

    // Emit socket event
    const io = getIO();
    io.to(`map-${commentData.map_id}`).emit('comment-created', newComment);
    console.log(`[SOCKET] Emitted comment-created event for map ${commentData.map_id}`);

    res.status(201).json(newComment);
  } catch (error) {
    console.error('[API] Error creating comment:', error);
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
    
    console.log(`[API] Updating comment ${commentId} by user ${userId}`);

    // Validate content
    if (!updateData.content) {
      console.log('[API] Comment update failed: Content is required');
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    // Check if user is the author
    const comment = await db.getComment(commentId);

    if (!comment) {
      console.log(`[API] Comment update failed: Comment ${commentId} not found`);
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.user_id !== userId) {
      console.log(`[API] Comment update failed: User ${userId} is not the author of comment ${commentId}`);
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
      console.log(`[API] Failed to update comment ${commentId}`);
      res.status(500).json({ error: 'Failed to update comment' });
      return;
    }

    console.log(`[API] Comment ${commentId} updated successfully`);

    // Get replies
    updatedComment.replies = await db.getCommentReplies(commentId);
    console.log(`[API] Fetched ${updatedComment.replies.length} replies for updated comment`);

    // Emit socket event
    const io = getIO();
    io.to(`map-${updatedComment.map_id}`).emit(
      'comment-updated',
      updatedComment,
    );
    console.log(`[SOCKET] Emitted comment-updated event for map ${updatedComment.map_id}`);

    res.json(updatedComment);
  } catch (error) {
    console.error('[API] Error updating comment:', error);
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
    
    console.log(`[API] Updating position of comment ${commentId} by user ${userId}`);
    console.log(`[API] New position: ${positionData.lng}, ${positionData.lat}`);

    // Validate position
    if (positionData.lng === undefined || positionData.lat === undefined) {
      console.log('[API] Position update failed: Missing coordinates');
      res.status(400).json({ error: 'Longitude and latitude are required' });
      return;
    }

    // Use a transaction to ensure position update is atomic
    const result = await db.tx('update-comment-position', async t => {
      // Check if user is the author
      const comment = await t.oneOrNone('SELECT * FROM comments WHERE id = $1', commentId);

      if (!comment) {
        console.log(`[API] Position update failed: Comment ${commentId} not found`);
        return { error: 'not_found' };
      }

      if (comment.user_id !== userId) {
        console.log(`[API] Position update failed: User ${userId} is not the author of comment ${commentId}`);
        return { error: 'unauthorized' };
      }

      // Update comment position
      const updatedComment = await t.oneOrNone(
        `UPDATE comments 
         SET lng = $1, lat = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 
         RETURNING *`,
        [positionData.lng, positionData.lat, commentId]
      );

      if (!updatedComment) {
        return { error: 'update_failed' };
      }

      // Get replies within the same transaction
      const replies = await t.any(
        'SELECT * FROM replies WHERE comment_id = $1 ORDER BY created_at ASC',
        commentId
      );

      return { comment: updatedComment, replies };
    });

    // Handle transaction results
    if (result.error === 'not_found') {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    
    if (result.error === 'unauthorized') {
      res.status(403).json({ error: 'Only the author can move this comment' });
      return;
    }
    
    if (result.error === 'update_failed') {
      res.status(500).json({ error: 'Failed to update comment position' });
      return;
    }

    console.log(`[API] Position of comment ${commentId} updated successfully`);

    // Prepare response
    const updatedComment = result.comment;
    updatedComment.replies = result.replies;

    // Emit socket event
    const io = getIO();
    io.to(`map-${updatedComment.map_id}`).emit('comment-moved', updatedComment);
    console.log(`[SOCKET] Emitted comment-moved event for map ${updatedComment.map_id}`);

    res.json(updatedComment);
  } catch (error) {
    console.error('[API] Error updating comment position:', error);
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
    
    console.log(`[API] Deleting comment ${commentId} by user ${userId}`);

    // Use a transaction to ensure we get the map ID before deletion
    const result = await db.tx('delete-comment', async t => {
      // Check if user is the author
      const comment = await t.oneOrNone('SELECT * FROM comments WHERE id = $1', commentId);

      if (!comment) {
        console.log(`[API] Comment deletion failed: Comment ${commentId} not found`);
        return { error: 'not_found' };
      }

      if (comment.user_id !== userId) {
        console.log(`[API] Comment deletion failed: User ${userId} is not the author of comment ${commentId}`);
        return { error: 'unauthorized' };
      }

      // Store the map ID for socket event
      const mapId = comment.map_id;

      // Delete comment (will cascade to replies)
      const result = await t.result('DELETE FROM comments WHERE id = $1', commentId);
      const deleted = result.rowCount > 0;

      if (!deleted) {
        return { error: 'delete_failed' };
      }

      return { success: true, mapId };
    });

    // Handle transaction results
    if (result.error === 'not_found') {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    
    if (result.error === 'unauthorized') {
      res.status(403).json({ error: 'Only the author can delete this comment' });
      return;
    }
    
    if (result.error === 'delete_failed') {
      res.status(500).json({ error: 'Failed to delete comment' });
      return;
    }

    console.log(`[API] Comment ${commentId} deleted successfully`);

    // Emit socket event
    const io = getIO();
    io.to(`map-${result.mapId}`).emit('comment-deleted', commentId);
    console.log(`[SOCKET] Emitted comment-deleted event for map ${result.mapId}`);

    res.status(204).send();
  } catch (error) {
    console.error('[API] Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};