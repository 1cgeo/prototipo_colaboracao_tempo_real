// Path: controllers\batch.controller.ts

import { Request, Response } from 'express';
import { db } from '../config/database.js';

/**
 * Process a batch of operations for offline clients that have reconnected
 * Operations are processed in order and within a transaction
 */
export const processBatchOperations = async (req: Request, res: Response): Promise<void> => {
  try {
    const mapId = parseInt(req.params.mapId, 10);
    const { operations } = req.body;
    
    // Extract user info from request headers or body
    const userId = req.headers['user-id'] as string || req.body.userId;
    const userName = req.headers['user-name'] as string || req.body.userName;
    
    if (!userId || !userName) {
      res.status(400).json({ error: 'User ID and name are required' });
      return;
    }
    
    if (!Array.isArray(operations) || operations.length === 0) {
      res.status(400).json({ error: 'No operations to process' });
      return;
    }
    
    console.log(`[API] Processing batch of ${operations.length} operations for map ${mapId} from user ${userName} (${userId})`);
    
    // Process all operations within a transaction
    const results = await db.tx('batch-operations', async t => {
      const batchResults = [];
      
      // Process operations in order (important for dependencies)
      for (const op of operations) {
        try {
          // Validate basic operation structure
          if (!op.id || !op.type || !op.data) {
            batchResults.push({
              id: op.id || 'unknown',
              success: false,
              error: 'Invalid operation format'
            });
            continue;
          }
          
          // Process based on operation type
          let result;
          
          switch (op.type) {
            case 'create-feature':
              result = await processCreateFeature(t, op, userId, userName, mapId);
              break;
              
            case 'update-feature':
              result = await processUpdateFeature(t, op, userId, userName, mapId);
              break;
              
            case 'delete-feature':
              result = await processDeleteFeature(t, op, userId, userName, mapId);
              break;
              
            case 'create-comment':
              result = await processCreateComment(t, op, userId, userName, mapId);
              break;
              
            case 'update-comment':
              result = await processUpdateComment(t, op, userId);
              break;
              
            case 'delete-comment':
              result = await processDeleteComment(t, op, userId);
              break;
              
            case 'create-reply':
              result = await processCreateReply(t, op, userId, userName);
              break;
              
            case 'update-reply':
              result = await processUpdateReply(t, op, userId);
              break;
              
            case 'delete-reply':
              result = await processDeleteReply(t, op, userId);
              break;
              
            default:
              result = {
                id: op.id,
                success: false,
                error: `Unknown operation type: ${op.type}`
              };
          }
          
          batchResults.push(result);
          
        } catch (error) {
          console.error(`[API] Error processing operation ${op.id}:`, error);
          batchResults.push({
            id: op.id,
            success: false,
            error: 'Internal server error'
          });
        }
      }
      
      return batchResults;
    }).catch(error => {
      console.error('[API] Transaction error in batch processing:', error);
      throw error;
    });
    
    // Summarize results
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    console.log(`[API] Batch processing complete: ${successCount} succeeded, ${failCount} failed`);
    
    res.json({
      results,
      timestamp: Date.now(),
      summary: {
        total: operations.length,
        succeeded: successCount,
        failed: failCount
      }
    });
    
  } catch (error) {
    console.error('[API] Error processing batch operations:', error);
    res.status(500).json({ error: 'Failed to process batch operations' });
  }
};

/**
 * Process a feature creation operation
 */
async function processCreateFeature(t: any, op: any, userId: string, userName: string, mapId: number) {
  // Validate map ID
  if (op.data.map_id !== mapId) {
    return {
      id: op.id,
      success: false,
      error: 'Feature map ID does not match endpoint map ID'
    };
  }
  
  // Add or override user info (security)
  const featureData = {
    ...op.data,
    user_id: userId,
    user_name: userName
  };
  
  // Create the feature
  const feature = await t.createFeature(featureData);
  
  // Record in history
  await t.recordFeatureCreation(feature, userId, userName, op.id);
  
  return {
    id: op.id,
    success: true,
    feature: feature,
    operation: 'create'
  };
}

/**
 * Process a feature update operation
 */
async function processUpdateFeature(t: any, op: any, userId: string, userName: string, mapId: number) {
  // Get current feature state
  const currentFeature = await t.getFeature(op.data.id);
  
  if (!currentFeature) {
    return {
      id: op.id,
      success: false,
      error: 'Feature not found'
    };
  }
  
  // Check if feature belongs to correct map
  if (currentFeature.map_id !== mapId) {
    return {
      id: op.id,
      success: false,
      error: 'Feature does not belong to specified map'
    };
  }
  
  // Update the feature
  const updateResult = await t.updateFeature(
    op.data.id,
    {
      geometry: op.data.geometry,
      properties: op.data.properties,
      version: op.data.version
    },
    userId,
    userName
  );
  
  if (!updateResult.success) {
    return {
      id: op.id,
      success: false,
      error: 'Feature update failed',
      currentVersion: updateResult.currentVersion,
      operation: 'update'
    };
  }
  
  return {
    id: op.id,
    success: true,
    feature: updateResult.feature,
    operation: 'update'
  };
}

/**
 * Process a feature deletion operation
 */
async function processDeleteFeature(t: any, op: any, userId: string, userName: string, mapId: number) {
  // Get feature before deletion for history
  const featureToDelete = await t.getFeature(op.data.id);
  
  if (!featureToDelete) {
    return {
      id: op.id,
      success: false,
      error: 'Feature not found'
    };
  }
  
  // Check if feature belongs to correct map
  if (featureToDelete.map_id !== mapId) {
    return {
      id: op.id,
      success: false,
      error: 'Feature does not belong to specified map'
    };
  }
  
  // Record in history before deletion
  await t.recordFeatureDeletion(featureToDelete, userId, userName, op.id);
  
  // Delete the feature
  const deleted = await t.deleteFeature(op.data.id);
  
  if (!deleted) {
    return {
      id: op.id,
      success: false,
      error: 'Feature deletion failed'
    };
  }
  
  return {
    id: op.id,
    success: true,
    featureId: op.data.id,
    operation: 'delete'
  };
}

/**
 * Process a comment creation operation
 */
async function processCreateComment(t: any, op: any, userId: string, userName: string, mapId: number) {
  // Validate map ID
  if (op.data.map_id !== mapId) {
    return {
      id: op.id,
      success: false,
      error: 'Comment map ID does not match endpoint map ID'
    };
  }
  
  // Add or override user info (security)
  const commentData = {
    ...op.data,
    user_id: userId,
    user_name: userName
  };
  
  // Create the comment
  const comment = await t.createComment(commentData);
  
  // Initialize empty replies array
  comment.replies = [];
  
  return {
    id: op.id,
    success: true,
    comment: comment,
    operation: 'create'
  };
}

/**
 * Process a comment update operation
 */
async function processUpdateComment(t: any, op: any, userId: string) {
  // Get current comment
  const comment = await t.getComment(op.data.id);
  
  if (!comment) {
    return {
      id: op.id,
      success: false,
      error: 'Comment not found'
    };
  }
  
  // Verify ownership
  if (comment.user_id !== userId) {
    return {
      id: op.id,
      success: false,
      error: 'Only the comment author can update it'
    };
  }
  
  // Update the comment
  const updatedComment = await t.updateComment(op.data.id, op.data.content);
  
  if (!updatedComment) {
    return {
      id: op.id,
      success: false,
      error: 'Comment update failed'
    };
  }
  
  // Get replies
  updatedComment.replies = await t.getCommentReplies(op.data.id);
  
  return {
    id: op.id,
    success: true,
    comment: updatedComment,
    operation: 'update'
  };
}

/**
 * Process a comment deletion operation
 */
async function processDeleteComment(t: any, op: any, userId: string) {
  // Get comment
  const comment = await t.getComment(op.data.id);
  
  if (!comment) {
    return {
      id: op.id,
      success: false,
      error: 'Comment not found'
    };
  }
  
  // Verify ownership
  if (comment.user_id !== userId) {
    return {
      id: op.id,
      success: false,
      error: 'Only the comment author can delete it'
    };
  }
  
  // Delete the comment
  const deleted = await t.deleteComment(op.data.id);
  
  if (!deleted) {
    return {
      id: op.id,
      success: false,
      error: 'Comment deletion failed'
    };
  }
  
  return {
    id: op.id,
    success: true,
    commentId: op.data.id,
    operation: 'delete'
  };
}

/**
 * Process a reply creation operation
 */
async function processCreateReply(t: any, op: any, userId: string, userName: string) {
  // Add or override user info (security)
  const replyData = {
    ...op.data,
    user_id: userId,
    user_name: userName
  };
  
  // Create the reply
  const reply = await t.createReply(replyData);
  
  return {
    id: op.id,
    success: true,
    reply: reply,
    commentId: op.data.comment_id,
    operation: 'create'
  };
}

/**
 * Process a reply update operation
 */
async function processUpdateReply(t: any, op: any, userId: string) {
  // Get current reply
  const reply = await t.getReply(op.data.id);
  
  if (!reply) {
    return {
      id: op.id,
      success: false,
      error: 'Reply not found'
    };
  }
  
  // Verify ownership
  if (reply.user_id !== userId) {
    return {
      id: op.id,
      success: false,
      error: 'Only the reply author can update it'
    };
  }
  
  // Update the reply
  const updatedReply = await t.updateReply(op.data.id, op.data.content);
  
  if (!updatedReply) {
    return {
      id: op.id,
      success: false,
      error: 'Reply update failed'
    };
  }
  
  return {
    id: op.id,
    success: true,
    reply: updatedReply,
    commentId: reply.comment_id,
    operation: 'update'
  };
}

/**
 * Process a reply deletion operation
 */
async function processDeleteReply(t: any, op: any, userId: string) {
  // Get reply
  const reply = await t.getReply(op.data.id);
  
  if (!reply) {
    return {
      id: op.id,
      success: false,
      error: 'Reply not found'
    };
  }
  
  // Verify ownership
  if (reply.user_id !== userId) {
    return {
      id: op.id,
      success: false,
      error: 'Only the reply author can delete it'
    };
  }
  
  // Delete the reply
  const deleted = await t.deleteReply(op.data.id);
  
  if (!deleted) {
    return {
      id: op.id,
      success: false,
      error: 'Reply deletion failed'
    };
  }
  
  return {
    id: op.id,
    success: true,
    replyId: op.data.id,
    commentId: reply.comment_id,
    operation: 'delete'
  };
}