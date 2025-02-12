import { useState, useCallback } from 'react';
import { 
  Comment,
  CommentCreateInput,
  CommentUpdateInput,
  ReplyCreateInput,
  ReplyUpdateInput,
  MapBounds
} from '../../types';
import { wsEvents } from '../../utils/api';
import { commentApi, replyApi } from './api';
import { useVersioning } from './useVersioning';

interface UseCommentStateProps {
  roomId: string | null;
  onError?: (error: Error) => void;
}

export const useCommentState = ({ roomId, onError }: UseCommentStateProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);

  const versioning = useVersioning();

  const loadComments = useCallback(async (newBounds?: MapBounds) => {
    if (!roomId) return;

    setLoading(true);
    try {
      const loadedComments = await commentApi.list(roomId, newBounds || bounds || undefined);
      setComments(loadedComments);
      if (newBounds) {
        setBounds(newBounds);
      }
      setError(null);

      // Update version tracking
      loadedComments.forEach(comment => {
        versioning.trackVersion('comment', comment.id, comment.version);
        comment.replies.forEach(reply => {
          versioning.trackVersion('reply', reply.id, reply.version);
        });
      });

    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [roomId, bounds, onError, versioning]);

  const createComment = useCallback(async (input: CommentCreateInput) => {
    if (!roomId) throw new Error('No room selected');

    try {
      const comment = await commentApi.create(roomId, input);
      setComments(prev => [...prev, comment]);
      versioning.trackVersion('comment', comment.id, comment.version);
      setError(null);
      wsEvents.createComment(roomId, input.content, input.location);
      return comment;
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    }
  }, [roomId, onError, versioning]);

  const updateComment = useCallback(async (commentId: string, input: CommentUpdateInput) => {
    if (!roomId) throw new Error('No room selected');

    versioning.addPendingChange('comment', commentId, {
      type: 'update',
      version: input.version,
      changes: input,
      timestamp: Date.now()
    });

    // Optimistic update
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          content: input.content,
          version: input.version,
          updated_at: new Date().toISOString()
        };
      }
      return c;
    }));

    try {
      const comment = await commentApi.update(roomId, commentId, input);
      setComments(prev => prev.map(c => c.id === comment.id ? comment : c));
      versioning.trackVersion('comment', comment.id, comment.version);
      setError(null);
      wsEvents.updateComment(roomId, commentId, input.content, input.version);
      return comment;
    } catch (error) {
      // Revert optimistic update on error
      const lastVersion = versioning.getLastVersion('comment', commentId);
      if (lastVersion) {
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            const originalComment = prev.find(orig => orig.id === commentId);
            return originalComment || c;
          }
          return c;
        }));
      }
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      versioning.removePendingChange('comment', commentId);
    }
  }, [roomId, onError, versioning]);

  const deleteComment = useCallback(async (commentId: string, version: number) => {
    if (!roomId) throw new Error('No room selected');

    versioning.addPendingChange('comment', commentId, {
      type: 'delete',
      version,
      timestamp: Date.now()
    });

    try {
      await commentApi.delete(roomId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      versioning.removeVersionTracking('comment', commentId);
      if (selectedComment === commentId) {
        setSelectedComment(null);
      }
      setError(null);
      wsEvents.deleteComment(roomId, commentId, version);
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    }
  }, [roomId, selectedComment, onError, versioning]);

  const createReply = useCallback(async (commentId: string, input: ReplyCreateInput) => {
    if (!roomId) throw new Error('No room selected');

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
      versioning.trackVersion('reply', reply.id, reply.version);
      setError(null);
      wsEvents.createReply(roomId, commentId, input.content);
      return reply;
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    }
  }, [roomId, onError, versioning]);

  const updateReply = useCallback(async (
    commentId: string,
    replyId: string,
    input: ReplyUpdateInput
  ) => {
    if (!roomId) throw new Error('No room selected');

    versioning.addPendingChange('reply', replyId, {
      type: 'update',
      version: input.version,
      changes: input,
      timestamp: Date.now()
    });

    // Optimistic update
    setComments(prev => prev.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: comment.replies.map(reply => {
            if (reply.id === replyId) {
              return {
                ...reply,
                content: input.content,
                version: input.version,
                updated_at: new Date().toISOString()
              };
            }
            return reply;
          })
        };
      }
      return comment;
    }));

    try {
      const reply = await replyApi.update(roomId, commentId, replyId, input);
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: comment.replies.map(r => r.id === reply.id ? reply : r)
          };
        }
        return comment;
      }));
      versioning.trackVersion('reply', reply.id, reply.version);
      setError(null);
      wsEvents.updateReply(roomId, commentId, replyId, input.content, input.version);
      return reply;
    } catch (error) {
      // Revert optimistic update on error
      const lastVersion = versioning.getLastVersion('reply', replyId);
      if (lastVersion) {
        setComments(prev => prev.map(comment => {
          if (comment.id === commentId) {
            const originalReply = comment.replies.find(orig => orig.id === replyId);
            if (originalReply) {
              return {
                ...comment,
                replies: comment.replies.map(r => 
                  r.id === replyId ? originalReply : r
                )
              };
            }
          }
          return comment;
        }));
      }
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      versioning.removePendingChange('reply', replyId);
    }
  }, [roomId, onError, versioning]);

  const deleteReply = useCallback(async (
    commentId: string,
    replyId: string,
    version: number
  ) => {
    if (!roomId) throw new Error('No room selected');

    versioning.addPendingChange('reply', replyId, {
      type: 'delete',
      version,
      timestamp: Date.now()
    });

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
      versioning.removeVersionTracking('reply', replyId);
      setError(null);
      wsEvents.deleteReply(roomId, commentId, replyId, version);
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    }
  }, [roomId, onError, versioning]);

  return {
    comments,
    selectedComment,
    loading,
    error,
    bounds,
    setComments,
    setSelectedComment,
    setBounds,
    loadComments,
    createComment,
    updateComment,
    deleteComment,
    createReply,
    updateReply,
    deleteReply
  };
};