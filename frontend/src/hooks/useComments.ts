import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Comment, 
  CommentCreateInput, 
  CommentUpdateInput,
  ReplyCreateInput,
  ReplyUpdateInput,
  Point,
  MapBounds,
  CommentCreateEvent,
  CommentUpdateEvent,
  CommentDeleteEvent,
  ReplyCreateEvent,
  ReplyUpdateEvent,
  ReplyDeleteEvent
} from '../types';
import { commentApi, replyApi, getSocket, wsEvents } from '../utils/api';

interface UseCommentsOptions {
  roomId: string | null;
  onError?: (error: Error) => void;
}

interface EntityChanges {
  content?: string;
  version?: number;
  location?: Point;
}

interface PendingChange {
  type: 'update' | 'delete';
  entityId: string;
  entityType: 'comment' | 'reply';
  version: number;
  changes?: EntityChanges;
  timestamp: number;
}

const useComments = ({ roomId, onError }: UseCommentsOptions) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  
  // Keep track of pending changes for version control
  const pendingChanges = useRef<Map<string, PendingChange>>(new Map());
  const lastSuccessfulVersion = useRef<Map<string, number>>(new Map());

  // Load comments
  const loadComments = useCallback(async (newBounds?: MapBounds) => {
    if (!roomId) return;

    setLoading(true);
    try {
      const comments = await commentApi.list(roomId, newBounds || bounds || undefined);
      setComments(comments);
      if (newBounds) {
        setBounds(newBounds);
      }
      setError(null);

      // Update version tracking
      comments.forEach(comment => {
        lastSuccessfulVersion.current.set(`comment-${comment.id}`, comment.version);
        comment.replies.forEach(reply => {
          lastSuccessfulVersion.current.set(`reply-${reply.id}`, reply.version);
        });
      });

    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [roomId, bounds, onError]);

  // WebSocket event handlers
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    const handleCommentCreate = (event: CommentCreateEvent) => {
      if (event.roomId !== roomId) return;

      // Only add comment if it's within current bounds
      if (bounds) {
        const [lng, lat] = event.location.coordinates;
        if (
          lng < bounds.sw.lng || lng > bounds.ne.lng ||
          lat < bounds.sw.lat || lat > bounds.ne.lat
        ) {
          return;
        }
      }

      setComments(prev => [...prev, {
        id: event.userId, // Temporary ID until server confirms
        content: event.content,
        location: event.location,
        authorId: event.userId,
        authorName: '', // Will be updated when server confirms
        version: 1,
        created_at: new Date(event.timestamp).toISOString(),
        updated_at: new Date(event.timestamp).toISOString(),
        replies: []
      }]);
    };

    const handleCommentUpdate = (event: CommentUpdateEvent) => {
      if (event.roomId !== roomId) return;

      const pendingChange = pendingChanges.current.get(`comment-${event.commentId}`);
      if (pendingChange && pendingChange.version >= event.version) {
        return; // Ignore outdated updates
      }

      setComments(prev => prev.map(comment => {
        if (comment.id === event.commentId) {
          return {
            ...comment,
            content: event.content,
            version: event.version,
            updated_at: new Date(event.timestamp).toISOString()
          };
        }
        return comment;
      }));

      // Update version tracking
      lastSuccessfulVersion.current.set(`comment-${event.commentId}`, event.version);
    };

    const handleCommentDelete = (event: CommentDeleteEvent) => {
      if (event.roomId !== roomId) return;

      const pendingChange = pendingChanges.current.get(`comment-${event.commentId}`);
      if (pendingChange && pendingChange.version >= event.version) {
        return; // Ignore outdated deletes
      }

      setComments(prev => prev.filter(c => c.id !== event.commentId));
      
      if (selectedComment === event.commentId) {
        setSelectedComment(null);
      }

      // Clean up tracking
      lastSuccessfulVersion.current.delete(`comment-${event.commentId}`);
      pendingChanges.current.delete(`comment-${event.commentId}`);
    };

    const handleReplyCreate = (event: ReplyCreateEvent) => {
      if (event.roomId !== roomId) return;

      setComments(prev => prev.map(comment => {
        if (comment.id === event.commentId) {
          return {
            ...comment,
            replies: [...comment.replies, {
              id: event.userId, // Temporary ID until server confirms
              content: event.content,
              authorId: event.userId,
              authorName: '', // Will be updated when server confirms
              version: 1,
              created_at: new Date(event.timestamp).toISOString(),
              updated_at: new Date(event.timestamp).toISOString()
            }]
          };
        }
        return comment;
      }));
    };

    const handleReplyUpdate = (event: ReplyUpdateEvent) => {
      if (event.roomId !== roomId) return;

      const pendingChange = pendingChanges.current.get(`reply-${event.replyId}`);
      if (pendingChange && pendingChange.version >= event.version) {
        return; // Ignore outdated updates
      }

      setComments(prev => prev.map(comment => {
        if (comment.id === event.commentId) {
          return {
            ...comment,
            replies: comment.replies.map(reply => {
              if (reply.id === event.replyId) {
                return {
                  ...reply,
                  content: event.content,
                  version: event.version,
                  updated_at: new Date(event.timestamp).toISOString()
                };
              }
              return reply;
            })
          };
        }
        return comment;
      }));

      // Update version tracking
      lastSuccessfulVersion.current.set(`reply-${event.replyId}`, event.version);
    };

    const handleReplyDelete = (event: ReplyDeleteEvent) => {
      if (event.roomId !== roomId) return;

      const pendingChange = pendingChanges.current.get(`reply-${event.replyId}`);
      if (pendingChange && pendingChange.version >= event.version) {
        return; // Ignore outdated deletes
      }

      setComments(prev => prev.map(comment => {
        if (comment.id === event.commentId) {
          return {
            ...comment,
            replies: comment.replies.filter(r => r.id !== event.replyId)
          };
        }
        return comment;
      }));

      // Clean up tracking
      lastSuccessfulVersion.current.delete(`reply-${event.replyId}`);
      pendingChanges.current.delete(`reply-${event.replyId}`);
    };

    // Register all event handlers
    socket.on('comment:create', handleCommentCreate);
    socket.on('comment:update', handleCommentUpdate);
    socket.on('comment:delete', handleCommentDelete);
    socket.on('reply:create', handleReplyCreate);
    socket.on('reply:update', handleReplyUpdate);
    socket.on('reply:delete', handleReplyDelete);

    return () => {
      // Cleanup all event handlers
      socket.off('comment:create', handleCommentCreate);
      socket.off('comment:update', handleCommentUpdate);
      socket.off('comment:delete', handleCommentDelete);
      socket.off('reply:create', handleReplyCreate);
      socket.off('reply:update', handleReplyUpdate);
      socket.off('reply:delete', handleReplyDelete);
    };
  }, [roomId, bounds, selectedComment]);

  // Create comment
  const createComment = useCallback(async (input: CommentCreateInput) => {
    if (!roomId) throw new Error('No room selected');

    try {
      const comment = await commentApi.create(roomId, input);
      setComments(prev => [...prev, comment]);
      lastSuccessfulVersion.current.set(`comment-${comment.id}`, comment.version);
      setError(null);
      wsEvents.createComment(roomId, input.content, input.location);
      return comment;
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    }
  }, [roomId, onError]);

  // Update comment with optimistic updates and version control
  const updateComment = useCallback(async (commentId: string, input: CommentUpdateInput) => {
    if (!roomId) throw new Error('No room selected');

    // Record pending change
    pendingChanges.current.set(`comment-${commentId}`, {
      type: 'update',
      entityId: commentId,
      entityType: 'comment',
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
      lastSuccessfulVersion.current.set(`comment-${comment.id}`, comment.version);
      pendingChanges.current.delete(`comment-${commentId}`);
      setError(null);
      wsEvents.updateComment(roomId, commentId, input.content, input.version);
      return comment;
    } catch (error) {
      // Revert optimistic update on error
      const lastVersion = lastSuccessfulVersion.current.get(`comment-${commentId}`);
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
      pendingChanges.current.delete(`comment-${commentId}`);
    }
  }, [roomId, onError]);

  // Delete comment
  const deleteComment = useCallback(async (commentId: string, version: number) => {
    if (!roomId) throw new Error('No room selected');

    // Record pending deletion
    pendingChanges.current.set(`comment-${commentId}`, {
      type: 'delete',
      entityId: commentId,
      entityType: 'comment',
      version,
      timestamp: Date.now()
    });

    try {
      await commentApi.delete(roomId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      lastSuccessfulVersion.current.delete(`comment-${commentId}`);
      pendingChanges.current.delete(`comment-${commentId}`);
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
  }, [roomId, selectedComment, onError]);

  // Create reply
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
      lastSuccessfulVersion.current.set(`reply-${reply.id}`, reply.version);
      setError(null);
      wsEvents.createReply(roomId, commentId, input.content);
      return reply;
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    }
  }, [roomId, onError]);

  // Update reply with optimistic updates and version control
  const updateReply = useCallback(async (
    commentId: string,
    replyId: string,
    input: ReplyUpdateInput
  ) => {
    if (!roomId) throw new Error('No room selected');

    // Record pending change
    pendingChanges.current.set(`reply-${replyId}`, {
      type: 'update',
      entityId: replyId,
      entityType: 'reply',
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
      lastSuccessfulVersion.current.set(`reply-${reply.id}`, reply.version);
      pendingChanges.current.delete(`reply-${replyId}`);
      setError(null);
      wsEvents.updateReply(roomId, commentId, replyId, input.content, input.version);
      return reply;
    } catch (error) {
      // Revert optimistic update on error
      const lastVersion = lastSuccessfulVersion.current.get(`reply-${replyId}`);
      if (lastVersion) {
        setComments(prev => prev.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              replies: comment.replies.map(reply => {
                if (reply.id === replyId) {
                  const originalReply = comment.replies.find(orig => orig.id === replyId);
                  return originalReply || reply;
                }
                return reply;
              })
            };
          }
          return comment;
        }));
      }
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      pendingChanges.current.delete(`reply-${replyId}`);
    }
  }, [roomId, onError]);

  // Delete reply
  const deleteReply = useCallback(async (commentId: string, replyId: string, version: number) => {
    if (!roomId) throw new Error('No room selected');

    // Record pending deletion
    pendingChanges.current.set(`reply-${replyId}`, {
      type: 'delete',
      entityId: replyId,
      entityType: 'reply',
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
      lastSuccessfulVersion.current.delete(`reply-${replyId}`);
      pendingChanges.current.delete(`reply-${replyId}`);
      setError(null);
      wsEvents.deleteReply(roomId, commentId, replyId, version);
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
      throw err;
    }
  }, [roomId, onError]);

  // Get comment by ID
  const getComment = useCallback((commentId: string) => {
    return comments.find(c => c.id === commentId) || null;
  }, [comments]);

  // Get reply by ID
  const getReply = useCallback((commentId: string, replyId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return null;
    return comment.replies.find(r => r.id === replyId) || null;
  }, [comments]);

  // Get comments near a point with spatial search
  const getNearbyComments = useCallback((
    point: Point,
    radiusInMeters: number = 100
  ) => {
    // Convert radius to approximate degrees
    // 1 degree at equator ≈ 111,319.9 meters
    const radiusInDegrees = radiusInMeters / 111319.9;

    const [targetLng, targetLat] = point.coordinates;
    const bounds = {
      ne: {
        lat: targetLat + radiusInDegrees,
        lng: targetLng + radiusInDegrees
      },
      sw: {
        lat: targetLat - radiusInDegrees,
        lng: targetLng - radiusInDegrees
      }
    };

    return comments.filter(comment => {
      const [lng, lat] = comment.location.coordinates;
      return (
        lng >= bounds.sw.lng && lng <= bounds.ne.lng &&
        lat >= bounds.sw.lat && lat <= bounds.ne.lat
      );
    });
  }, [comments]);

  // Update visible bounds and reload comments
  const updateBounds = useCallback((newBounds: MapBounds) => {
    setBounds(newBounds);
    loadComments(newBounds);
  }, [loadComments]);

  // Version management utilities
  const getCurrentVersion = useCallback((entityType: 'comment' | 'reply', entityId: string) => {
    const key = `${entityType}-${entityId}`;
    return lastSuccessfulVersion.current.get(key) || 0;
  }, []);

  const hasPendingChanges = useCallback((entityType: 'comment' | 'reply', entityId: string) => {
    const key = `${entityType}-${entityId}`;
    return pendingChanges.current.has(key);
  }, []);

  // Cleanup on unmount or room change
  useEffect(() => {
    if (!roomId) {
      setComments([]);
      setSelectedComment(null);
      setBounds(null);
      pendingChanges.current.clear();
      lastSuccessfulVersion.current.clear();
    }
  }, [roomId]);

  return {
    comments,
    selectedComment,
    loading,
    error,
    bounds,
    loadComments,
    createComment,
    updateComment,
    deleteComment,
    createReply,
    updateReply,
    deleteReply,
    getComment,
    getReply,
    getNearbyComments,
    updateBounds,
    getCurrentVersion,
    hasPendingChanges,
    selectComment: setSelectedComment
  };
};

export default useComments;