import { useState, useEffect, useCallback } from 'react';
import { 
  Comment, 
  CommentCreateInput, 
  CommentUpdateInput,
  ReplyCreateInput,
  ReplyUpdateInput,
  Point 
} from '../types';
import { commentApi, replyApi } from '../utils/api';

interface UseCommentsOptions {
  roomId: string | null;
  onError?: (error: Error) => void;
}

const useComments = ({ roomId, onError }: UseCommentsOptions) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load comments
  const loadComments = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);
    try {
      const comments = await commentApi.list(roomId);
      setComments(comments);
      setError(null);
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [roomId, onError]);

  // Load comments when room changes
  useEffect(() => {
    if (roomId) {
      loadComments();
    } else {
      setComments([]);
      setSelectedComment(null);
    }
  }, [roomId, loadComments]);

  // Create comment
  const createComment = useCallback(async (input: CommentCreateInput) => {
    if (!roomId) throw new Error('No room selected');

    setLoading(true);
    try {
      const comment = await commentApi.create(roomId, input);
      setComments(prev => [...prev, comment]);
      setError(null);
      return comment;
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, onError]);

  // Update comment
  const updateComment = useCallback(async (commentId: string, input: CommentUpdateInput) => {
    if (!roomId) throw new Error('No room selected');

    setLoading(true);
    try {
      const comment = await commentApi.update(roomId, commentId, input);
      setComments(prev => 
        prev.map(c => c.id === comment.id ? comment : c)
      );
      setError(null);
      return comment;
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, onError]);

  // Delete comment
  const deleteComment = useCallback(async (commentId: string) => {
    if (!roomId) throw new Error('No room selected');

    setLoading(true);
    try {
      await commentApi.delete(roomId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (selectedComment === commentId) {
        setSelectedComment(null);
      }
      setError(null);
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, selectedComment, onError]);

  // Create reply
  const createReply = useCallback(async (commentId: string, input: ReplyCreateInput) => {
    if (!roomId) throw new Error('No room selected');

    setLoading(true);
    try {
      const reply = await replyApi.create(roomId, commentId, input);
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: [...comment.replies, reply]
          };
        }
        return comment;
      }));
      setError(null);
      return reply;
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, onError]);

  // Update reply
  const updateReply = useCallback(async (
    commentId: string,
    replyId: string,
    input: ReplyUpdateInput
  ) => {
    if (!roomId) throw new Error('No room selected');

    setLoading(true);
    try {
      const reply = await replyApi.update(roomId, commentId, replyId, input);
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: comment.replies.map(r => 
              r.id === replyId ? reply : r
            )
          };
        }
        return comment;
      }));
      setError(null);
      return reply;
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, onError]);

  // Delete reply
  const deleteReply = useCallback(async (commentId: string, replyId: string) => {
    if (!roomId) throw new Error('No room selected');

    setLoading(true);
    try {
      await replyApi.delete(roomId, commentId, replyId);
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: comment.replies.filter(r => r.id !== replyId)
          };
        }
        return comment;
      }));
      setError(null);
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [roomId, onError]);

  // Get comment by ID
  const getComment = useCallback((commentId: string) => {
    return comments.find(c => c.id === commentId) || null;
  }, [comments]);

  // Get comments near a point
  const getNearbyComments = useCallback((
    point: Point,
    radiusInMeters: number = 100
  ) => {
    // Simple distance calculation (not taking into account Earth's curvature)
    // For more accuracy, consider using a geospatial library
    const [targetLng, targetLat] = point.coordinates;
    return comments.filter(comment => {
      const [lng, lat] = comment.location.coordinates;
      const dx = (lng - targetLng) * Math.cos(lat * Math.PI / 180);
      const dy = lat - targetLat;
      const distance = Math.sqrt(dx * dx + dy * dy) * 111319.9; // Convert to meters
      return distance <= radiusInMeters;
    });
  }, [comments]);

  return {
    comments,
    selectedComment,
    loading,
    error,
    loadComments,
    createComment,
    updateComment,
    deleteComment,
    createReply,
    updateReply,
    deleteReply,
    getComment,
    getNearbyComments,
    selectComment: setSelectedComment
  };
};

export default useComments;