// services/socket/handlers/comment-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser } from '@/types/socket.js';
import { db } from '@/config/database.js';
import { CommentCreateData, ReplyCreateData } from '@/types/index.js';

/**
 * Set up comment socket handlers
 */
export function setupCommentHandlers(
  io: SocketIOServer,
  user: SocketUser,
  _rooms: any // Using underscore to mark as intentionally unused parameter
): void {
  const { socket } = user;
  
  // Get comments for current map
  socket.on('get-comments', async () => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} requesting comments for map ${mapId}`);
      
      // Get all comments for the map
      const comments = await db.getMapComments(mapId);
      console.log(`[SOCKET] Found ${comments.length} comments for map ${mapId}`);
      
      // Get all replies for these comments
      for (const comment of comments) {
        comment.replies = await db.getCommentReplies(comment.id);
      }
      
      socket.emit('comments-loaded', comments);
      
    } catch (error) {
      console.error('[SOCKET] Error getting comments:', error);
      socket.emit('error', 'Failed to load comments');
    }
  });
  
  // Create comment
  socket.on('create-comment', async (commentData: Omit<CommentCreateData, 'user_id' | 'user_name'>) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} creating new comment for map ${commentData.map_id}`);
      
      // Validate required fields
      if (
        !commentData.map_id ||
        !commentData.content ||
        commentData.lng === undefined ||
        commentData.lat === undefined
      ) {
        socket.emit('error', 'Missing required fields');
        return;
      }
      
      // Add user info to data
      const fullCommentData: CommentCreateData = {
        ...commentData,
        user_id: user.id,
        user_name: user.name
      };
      
      // Create comment
      const newComment = await db.createComment(fullCommentData);
      
      // Initialize empty replies array
      newComment.replies = [];
      
      console.log(`[SOCKET] Comment created successfully with ID ${newComment.id}`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('comment-created', newComment);
      
    } catch (error) {
      console.error('[SOCKET] Error creating comment:', error);
      socket.emit('error', 'Failed to create comment');
    }
  });
  
  // Update comment
  socket.on('update-comment', async (data: { id: number, content: string }) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const { id, content } = data;
      console.log(`[SOCKET] User ${user.id} updating comment ${id}`);
      
      // Validate content
      if (!content) {
        socket.emit('error', 'Content is required');
        return;
      }
      
      // Check if user is the author
      const comment = await db.getComment(id);
      
      if (!comment) {
        socket.emit('error', 'Comment not found');
        return;
      }
      
      if (comment.user_id !== user.id) {
        socket.emit('error', 'Only the author can update this comment');
        return;
      }
      
      // Update comment
      const updatedComment = await db.updateComment(id, content);
      
      if (!updatedComment) {
        socket.emit('error', 'Failed to update comment');
        return;
      }
      
      // Get replies
      updatedComment.replies = await db.getCommentReplies(id);
      
      console.log(`[SOCKET] Comment ${id} updated successfully`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('comment-updated', updatedComment);
      
    } catch (error) {
      console.error('[SOCKET] Error updating comment:', error);
      socket.emit('error', 'Failed to update comment');
    }
  });
  
  // Update comment position
  socket.on('update-comment-position', async (data: { id: number, lng: number, lat: number }) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const { id, lng, lat } = data;
      console.log(`[SOCKET] User ${user.id} updating position of comment ${id}`);
      
      // Validate position
      if (lng === undefined || lat === undefined) {
        socket.emit('error', 'Longitude and latitude are required');
        return;
      }
      
      // Check if user is the author
      const comment = await db.getComment(id);
      
      if (!comment) {
        socket.emit('error', 'Comment not found');
        return;
      }
      
      if (comment.user_id !== user.id) {
        socket.emit('error', 'Only the author can move this comment');
        return;
      }
      
      // Update comment position
      const updatedComment = await db.updateCommentPosition(id, lng, lat);
      
      if (!updatedComment) {
        socket.emit('error', 'Failed to update comment position');
        return;
      }
      
      // Get replies
      updatedComment.replies = await db.getCommentReplies(id);
      
      console.log(`[SOCKET] Position of comment ${id} updated successfully`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('comment-moved', updatedComment);
      
    } catch (error) {
      console.error('[SOCKET] Error updating comment position:', error);
      socket.emit('error', 'Failed to update comment position');
    }
  });
  
  // Delete comment
  socket.on('delete-comment', async (commentId: number) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} deleting comment ${commentId}`);
      
      // Check if user is the author
      const comment = await db.getComment(commentId);
      
      if (!comment) {
        socket.emit('error', 'Comment not found');
        return;
      }
      
      if (comment.user_id !== user.id) {
        socket.emit('error', 'Only the author can delete this comment');
        return;
      }
      
      // Delete comment (will cascade to replies)
      const deleted = await db.deleteComment(commentId);
      
      if (!deleted) {
        socket.emit('error', 'Failed to delete comment');
        return;
      }
      
      console.log(`[SOCKET] Comment ${commentId} deleted successfully`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('comment-deleted', commentId);
      
    } catch (error) {
      console.error('[SOCKET] Error deleting comment:', error);
      socket.emit('error', 'Failed to delete comment');
    }
  });
  
  // Create reply
  socket.on('create-reply', async (replyData: Omit<ReplyCreateData, 'user_id' | 'user_name'>) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} creating new reply for comment ${replyData.comment_id}`);
      
      // Validate required fields
      if (!replyData.comment_id || !replyData.content) {
        socket.emit('error', 'Missing required fields');
        return;
      }
      
      // Add user info to data
      const fullReplyData: ReplyCreateData = {
        ...replyData,
        user_id: user.id,
        user_name: user.name
      };
      
      // Check if parent comment exists and get its map_id
      const parentComment = await db.getComment(replyData.comment_id);
      
      if (!parentComment) {
        socket.emit('error', 'Parent comment not found');
        return;
      }
      
      // Create reply
      const newReply = await db.createReply(fullReplyData);
      
      console.log(`[SOCKET] Reply created successfully with ID ${newReply.id}`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('reply-created', {
        reply: newReply,
        commentId: replyData.comment_id
      });
      
    } catch (error) {
      console.error('[SOCKET] Error creating reply:', error);
      socket.emit('error', 'Failed to create reply');
    }
  });
  
  // Update reply
  socket.on('update-reply', async (data: { id: number, content: string }) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const { id, content } = data;
      console.log(`[SOCKET] User ${user.id} updating reply ${id}`);
      
      // Validate content
      if (!content) {
        socket.emit('error', 'Content is required');
        return;
      }
      
      // Check if user is the author
      const reply = await db.getReply(id);
      
      if (!reply) {
        socket.emit('error', 'Reply not found');
        return;
      }
      
      if (reply.user_id !== user.id) {
        socket.emit('error', 'Only the author can update this reply');
        return;
      }
      
      // Update reply
      const updatedReply = await db.updateReply(id, content);
      
      if (!updatedReply) {
        socket.emit('error', 'Failed to update reply');
        return;
      }
      
      console.log(`[SOCKET] Reply ${id} updated successfully`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('reply-updated', {
        reply: updatedReply,
        commentId: reply.comment_id
      });
      
    } catch (error) {
      console.error('[SOCKET] Error updating reply:', error);
      socket.emit('error', 'Failed to update reply');
    }
  });
  
  // Delete reply
  socket.on('delete-reply', async (replyId: number) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      console.log(`[SOCKET] User ${user.id} deleting reply ${replyId}`);
      
      // Check if user is the author
      const reply = await db.getReply(replyId);
      
      if (!reply) {
        socket.emit('error', 'Reply not found');
        return;
      }
      
      if (reply.user_id !== user.id) {
        socket.emit('error', 'Only the author can delete this reply');
        return;
      }
      
      // Store the comment ID for socket event
      const commentId = reply.comment_id;
      
      // Delete reply
      const deleted = await db.deleteReply(replyId);
      
      if (!deleted) {
        socket.emit('error', 'Failed to delete reply');
        return;
      }
      
      console.log(`[SOCKET] Reply ${replyId} deleted successfully`);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('reply-deleted', {
        replyId,
        commentId
      });
      
    } catch (error) {
      console.error('[SOCKET] Error deleting reply:', error);
      socket.emit('error', 'Failed to delete reply');
    }
  });
}