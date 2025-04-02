// Path: services\socket\handlers\comment-handler.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketUser } from '@/types/socket.js';
import { db } from '@/config/database.js';
import { CommentCreateData, ReplyCreateData } from '@/types/index.js';

/**
 * Validate comment data
 */
function validateCommentData(data: any): { valid: boolean; message?: string } {
  // Check required fields
  if (!data || typeof data !== 'object') {
    return { valid: false, message: 'Comment data is required' };
  }
  
  // Validate map_id
  if (!data.map_id || typeof data.map_id !== 'number' || data.map_id <= 0) {
    return { valid: false, message: 'Valid map ID is required' };
  }
  
  // Validate content
  if (!data.content || typeof data.content !== 'string' || data.content.trim() === '') {
    return { valid: false, message: 'Comment content cannot be empty' };
  }
  
  if (data.content.length > 5000) {
    return { valid: false, message: 'Comment content exceeds maximum length (5000 characters)' };
  }
  
  // Validate coordinates
  if (data.lng === undefined || typeof data.lng !== 'number') {
    return { valid: false, message: 'Valid longitude is required' };
  }
  
  if (data.lat === undefined || typeof data.lat !== 'number') {
    return { valid: false, message: 'Valid latitude is required' };
  }
  
  // Check coordinates are within valid range
  if (data.lng < -180 || data.lng > 180) {
    return { valid: false, message: 'Longitude must be between -180 and 180' };
  }
  
  if (data.lat < -90 || data.lat > 90) {
    return { valid: false, message: 'Latitude must be between -90 and 90' };
  }
  
  return { valid: true };
}

/**
 * Validate reply data
 */
function validateReplyData(data: any): { valid: boolean; message?: string } {
  // Check required fields
  if (!data || typeof data !== 'object') {
    return { valid: false, message: 'Reply data is required' };
  }
  
  // Validate comment_id
  if (!data.comment_id || typeof data.comment_id !== 'string' || data.comment_id.trim() === '') {
    return { valid: false, message: 'Valid comment ID is required' };
  }
  
  // Validate content
  if (!data.content || typeof data.content !== 'string' || data.content.trim() === '') {
    return { valid: false, message: 'Reply content cannot be empty' };
  }
  
  if (data.content.length > 2000) {
    return { valid: false, message: 'Reply content exceeds maximum length (2000 characters)' };
  }
  
  return { valid: true };
}

/**
 * Set up comment socket handlers with batch operations
 */
export function setupCommentHandlers(
  io: SocketIOServer,
  user: SocketUser,
  _rooms: any
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
  
  // NEW: Process batch comment operations for offline sync
  socket.on('batch-comment-operations', async (operations) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      const mapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      console.log(`[SOCKET] User ${user.id} submitting batch comment operations for map ${mapId}`);
      
      if (!Array.isArray(operations) || operations.length === 0) {
        socket.emit('error', 'Invalid batch operations');
        return;
      }
      
      console.log(`[SOCKET] Processing ${operations.length} batch comment operations`);
      
      // Process operations in order
      const results = [];
      const broadcasts = [];
      
      for (const op of operations) {
        try {
          if (!op.type || !op.data || !op.timestamp) {
            results.push({
              success: false,
              operationId: op.id,
              error: 'Invalid operation format'
            });
            continue;
          }
          
          let result;
          let broadcastEvent;
          let broadcastData;
          
          switch (op.type) {
            case 'create-comment':
              // Validate data
              const commentValidation = validateCommentData(op.data);
              if (!commentValidation.valid) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: commentValidation.message
                };
                break;
              }
              
              // Check if map_id matches current room
              if (op.data.map_id !== mapId) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Comment must be created in the current map'
                };
                break;
              }
              
              // Add user info
              const fullCommentData: CommentCreateData = {
                ...op.data,
                content: op.data.content.trim(),
                user_id: user.id,
                user_name: user.name
              };
              
              // Create comment
              const newComment = await db.createComment(fullCommentData);
              newComment.replies = [];
              
              result = {
                success: true,
                operationId: op.id,
                comment: newComment
              };
              
              // Prepare broadcast
              broadcastEvent = 'comment-created';
              broadcastData = newComment;
              break;
              
            case 'update-comment':
              // Validate data
              if (!op.data.id || typeof op.data.id !== 'string' || 
                  !op.data.content || typeof op.data.content !== 'string') {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Invalid comment update data'
                };
                break;
              }
              
              // Check if user is the author
              const commentToUpdate = await db.getComment(op.data.id);
              
              if (!commentToUpdate) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Comment not found'
                };
                break;
              }
              
              if (commentToUpdate.user_id !== user.id) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Only the author can update this comment'
                };
                break;
              }
              
              // Update comment
              const updatedComment = await db.updateComment(op.data.id, op.data.content.trim());
              
              if (!updatedComment) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Failed to update comment'
                };
                break;
              }
              
              // Get replies
              updatedComment.replies = await db.getCommentReplies(op.data.id);
              
              result = {
                success: true,
                operationId: op.id,
                comment: updatedComment
              };
              
              // Prepare broadcast
              broadcastEvent = 'comment-updated';
              broadcastData = updatedComment;
              break;
              
            case 'move-comment':
              // Validate data
              if (!op.data.id || typeof op.data.id !== 'string' ||
                  op.data.lng === undefined || typeof op.data.lng !== 'number' ||
                  op.data.lat === undefined || typeof op.data.lat !== 'number') {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Invalid comment move data'
                };
                break;
              }
              
              // Check coordinates are within valid range
              if (op.data.lng < -180 || op.data.lng > 180) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Longitude must be between -180 and 180'
                };
                break;
              }
              
              if (op.data.lat < -90 || op.data.lat > 90) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Latitude must be between -90 and 90'
                };
                break;
              }
              
              // Check if user is the author
              const commentToMove = await db.getComment(op.data.id);
              
              if (!commentToMove) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Comment not found'
                };
                break;
              }
              
              if (commentToMove.user_id !== user.id) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Only the author can move this comment'
                };
                break;
              }
              
              // Update comment position
              const movedComment = await db.updateCommentPosition(
                op.data.id, op.data.lng, op.data.lat
              );
              
              if (!movedComment) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Failed to move comment'
                };
                break;
              }
              
              // Get replies
              movedComment.replies = await db.getCommentReplies(op.data.id);
              
              result = {
                success: true,
                operationId: op.id,
                comment: movedComment
              };
              
              // Prepare broadcast
              broadcastEvent = 'comment-moved';
              broadcastData = movedComment;
              break;
              
            case 'delete-comment':
              // Validate data
              if (!op.data.id || typeof op.data.id !== 'string') {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Invalid comment ID'
                };
                break;
              }
              
              // Check if user is the author
              const commentToDelete = await db.getComment(op.data.id);
              
              if (!commentToDelete) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Comment not found'
                };
                break;
              }
              
              if (commentToDelete.user_id !== user.id) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Only the author can delete this comment'
                };
                break;
              }
              
              // Delete comment
              const commentDeleted = await db.deleteComment(op.data.id);
              
              if (!commentDeleted) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Failed to delete comment'
                };
                break;
              }
              
              result = {
                success: true,
                operationId: op.id,
                commentId: op.data.id
              };
              
              // Prepare broadcast
              broadcastEvent = 'comment-deleted';
              broadcastData = op.data.id;
              break;
              
            case 'create-reply':
              // Validate data
              const replyValidation = validateReplyData(op.data);
              if (!replyValidation.valid) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: replyValidation.message
                };
                break;
              }
              
              // Check if parent comment exists and get its map_id
              const parentComment = await db.getComment(op.data.comment_id);
              
              if (!parentComment) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Parent comment not found'
                };
                break;
              }
              
              // Check if comment belongs to current map
              if (parentComment.map_id !== mapId) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Cannot reply to a comment from a different map'
                };
                break;
              }
              
              // Add user info
              const fullReplyData: ReplyCreateData = {
                ...op.data,
                content: op.data.content.trim(),
                user_id: user.id,
                user_name: user.name
              };
              
              // Create reply
              const newReply = await db.createReply(fullReplyData);
              
              result = {
                success: true,
                operationId: op.id,
                reply: newReply,
                commentId: op.data.comment_id
              };
              
              // Prepare broadcast
              broadcastEvent = 'reply-created';
              broadcastData = {
                reply: newReply,
                commentId: op.data.comment_id
              };
              break;
              
            case 'update-reply':
              // Validate data
              if (!op.data.id || typeof op.data.id !== 'string' ||
                  !op.data.content || typeof op.data.content !== 'string') {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Invalid reply update data'
                };
                break;
              }
              
              // Check if user is the author
              const replyToUpdate = await db.getReply(op.data.id);
              
              if (!replyToUpdate) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Reply not found'
                };
                break;
              }
              
              if (replyToUpdate.user_id !== user.id) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Only the author can update this reply'
                };
                break;
              }
              
              // Update reply
              const updatedReply = await db.updateReply(op.data.id, op.data.content.trim());
              
              if (!updatedReply) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Failed to update reply'
                };
                break;
              }
              
              result = {
                success: true,
                operationId: op.id,
                reply: updatedReply,
                commentId: replyToUpdate.comment_id
              };
              
              // Prepare broadcast
              broadcastEvent = 'reply-updated';
              broadcastData = {
                reply: updatedReply,
                commentId: replyToUpdate.comment_id
              };
              break;
              
            case 'delete-reply':
              // Validate data
              if (!op.data.id || typeof op.data.id !== 'string') {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Invalid reply ID'
                };
                break;
              }
              
              // Check if user is the author
              const replyToDelete = await db.getReply(op.data.id);
              
              if (!replyToDelete) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Reply not found'
                };
                break;
              }
              
              if (replyToDelete.user_id !== user.id) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Only the author can delete this reply'
                };
                break;
              }
              
              // Store comment ID for broadcast
              const commentId = replyToDelete.comment_id;
              
              // Delete reply
              const replyDeleted = await db.deleteReply(op.data.id);
              
              if (!replyDeleted) {
                result = {
                  success: false,
                  operationId: op.id,
                  error: 'Failed to delete reply'
                };
                break;
              }
              
              result = {
                success: true,
                operationId: op.id,
                replyId: op.data.id,
                commentId
              };
              
              // Prepare broadcast
              broadcastEvent = 'reply-deleted';
              broadcastData = {
                replyId: op.data.id,
                commentId
              };
              break;
              
            default:
              result = {
                success: false,
                operationId: op.id,
                error: `Unknown operation type: ${op.type}`
              };
          }
          
          results.push(result);
          
          if (broadcastEvent && broadcastData) {
            broadcasts.push({ event: broadcastEvent, data: broadcastData });
          }
          
        } catch (error) {
          console.error(`[SOCKET] Error processing comment operation ${op.id}:`, error);
          results.push({
            success: false,
            operationId: op.id,
            error: 'Internal server error'
          });
        }
      }
      
      // Send results back to client
      socket.emit('batch-comment-results', {
        results,
        timestamp: Date.now()
      });
      
      // Broadcast changes to all users in the room
      for (const broadcast of broadcasts) {
        io.to(user.currentRoom).emit(broadcast.event, broadcast.data);
      }
      
      console.log(`[SOCKET] Completed batch comment operations: ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed`);
      
    } catch (error) {
      console.error('[SOCKET] Error processing batch comment operations:', error);
      socket.emit('error', 'Failed to process batch comment operations');
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
      
      // Validate data
      const validation = validateCommentData(commentData);
      if (!validation.valid) {
        socket.emit('error', validation.message);
        return;
      }
      
      // Check if map_id matches current room
      const roomMapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      if (commentData.map_id !== roomMapId) {
        socket.emit('error', 'Comment must be created in the current map');
        return;
      }
      
      // Add user info to data
      const fullCommentData: CommentCreateData = {
        ...commentData,
        content: commentData.content.trim(), // Sanitize content
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
  socket.on('update-comment', async (data: { id: string, content: string }) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Validate ID
      if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
        socket.emit('error', 'Invalid comment ID');
        return;
      }
      
      // Validate content
      if (!data.content || typeof data.content !== 'string' || data.content.trim() === '') {
        socket.emit('error', 'Comment content cannot be empty');
        return;
      }
      
      if (data.content.length > 5000) {
        socket.emit('error', 'Comment content exceeds maximum length (5000 characters)');
        return;
      }
      
      const { id, content } = data;
      console.log(`[SOCKET] User ${user.id} updating comment ${id}`);
      
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
      const updatedComment = await db.updateComment(id, content.trim());
      
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
  socket.on('update-comment-position', async (data: { id: string, lng: number, lat: number }) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Validate ID
      if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
        socket.emit('error', 'Invalid comment ID');
        return;
      }
      
      // Validate coordinates
      if (data.lng === undefined || typeof data.lng !== 'number') {
        socket.emit('error', 'Valid longitude is required');
        return;
      }
      
      if (data.lat === undefined || typeof data.lat !== 'number') {
        socket.emit('error', 'Valid latitude is required');
        return;
      }
      
      // Check coordinates are within valid range
      if (data.lng < -180 || data.lng > 180) {
        socket.emit('error', 'Longitude must be between -180 and 180');
        return;
      }
      
      if (data.lat < -90 || data.lat > 90) {
        socket.emit('error', 'Latitude must be between -90 and 90');
        return;
      }
      
      const { id, lng, lat } = data;
      console.log(`[SOCKET] User ${user.id} updating position of comment ${id}`);
      
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
  socket.on('delete-comment', async (commentId: string) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Validate ID
      if (!commentId || typeof commentId !== 'string' || commentId.trim() === '') {
        socket.emit('error', 'Invalid comment ID');
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
      
      // Validate data
      const validation = validateReplyData(replyData);
      if (!validation.valid) {
        socket.emit('error', validation.message);
        return;
      }
      
      // Add user info to data
      const fullReplyData: ReplyCreateData = {
        ...replyData,
        content: replyData.content.trim(), // Sanitize content
        user_id: user.id,
        user_name: user.name
      };
      
      // Check if parent comment exists and get its map_id
      const parentComment = await db.getComment(replyData.comment_id);
      
      if (!parentComment) {
        socket.emit('error', 'Parent comment not found');
        return;
      }
      
      // Check if the comment belongs to the current map
      const roomMapId = parseInt(user.currentRoom.replace('map-', ''), 10);
      if (parentComment.map_id !== roomMapId) {
        socket.emit('error', 'Cannot reply to a comment from a different map');
        return;
      }
      
      // Create the reply
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
  socket.on('update-reply', async (data: { id: string, content: string }) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Validate ID
      if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
        socket.emit('error', 'Invalid reply ID');
        return;
      }
      
      // Validate content
      if (!data.content || typeof data.content !== 'string' || data.content.trim() === '') {
        socket.emit('error', 'Reply content cannot be empty');
        return;
      }
      
      if (data.content.length > 2000) {
        socket.emit('error', 'Reply content exceeds maximum length (2000 characters)');
        return;
      }
      
      const { id, content } = data;
      console.log(`[SOCKET] User ${user.id} updating reply ${id}`);
      
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
      const updatedReply = await db.updateReply(id, content.trim());
      
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
  socket.on('delete-reply', async (replyId: string) => {
    try {
      if (!user.currentRoom) {
        socket.emit('error', 'You must join a map first');
        return;
      }
      
      // Validate ID
      if (!replyId || typeof replyId !== 'string' || replyId.trim() === '') {
        socket.emit('error', 'Invalid reply ID');
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