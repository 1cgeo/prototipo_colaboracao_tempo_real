import { useEffect } from 'react';
import { Comment, Point, MapBounds } from '../../types';
import { getSocket } from '../../utils/api';
import { useCommentState } from './useCommentState';
import { useCommentEvents } from './useCommentEvents';
import { useReplyEvents } from './useReplyEvents';
import { UseCommentsOptions } from './types';

const useComments = ({ roomId, onError }: UseCommentsOptions) => {
  const {
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
  } = useCommentState({ roomId, onError });

  // Initialize event handlers
  const commentEvents = useCommentEvents({
    bounds,
    setComments,
    setSelectedComment
  });

  const replyEvents = useReplyEvents({
    setComments
  });

  // Setup WebSocket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    // Register event handlers
    socket.on('comment:create', commentEvents.handleCommentCreate);
    socket.on('comment:update', commentEvents.handleCommentUpdate);
    socket.on('comment:delete', commentEvents.handleCommentDelete);
    socket.on('reply:create', replyEvents.handleReplyCreate);
    socket.on('reply:update', replyEvents.handleReplyUpdate);
    socket.on('reply:delete', replyEvents.handleReplyDelete);

    return () => {
      // Cleanup event handlers
      socket.off('comment:create', commentEvents.handleCommentCreate);
      socket.off('comment:update', commentEvents.handleCommentUpdate);
      socket.off('comment:delete', commentEvents.handleCommentDelete);
      socket.off('reply:create', replyEvents.handleReplyCreate);
      socket.off('reply:update', replyEvents.handleReplyUpdate);
      socket.off('reply:delete', replyEvents.handleReplyDelete);
    };
  }, [roomId, commentEvents, replyEvents]);

  // Reset state when room changes
  useEffect(() => {
    if (!roomId) {
      setComments([]);
      setSelectedComment(null);
      setBounds(null);
    }
  }, [roomId, setComments, setSelectedComment, setBounds]);

  // Utility functions
  const getComment = (commentId: string): Comment | null => {
    return comments.find(c => c.id === commentId) || null;
  };

  const getNearbyComments = (point: Point, radiusInMeters: number = 100): Comment[] => {
    // Convert radius to approximate degrees
    // 1 degree at equator ≈ 111,319.9 meters
    const radiusInDegrees = radiusInMeters / 111319.9;

    const [targetLng, targetLat] = point.coordinates;
    const searchBounds = {
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
        lng >= searchBounds.sw.lng && lng <= searchBounds.ne.lng &&
        lat >= searchBounds.sw.lat && lat <= searchBounds.ne.lat
      );
    });
  };

  const updateBounds = (newBounds: MapBounds) => {
    setBounds(newBounds);
    loadComments(newBounds);
  };

  return {
    // State
    comments,
    selectedComment,
    loading,
    error,
    bounds,

    // Core operations
    loadComments,
    createComment,
    updateComment,
    deleteComment,
    createReply,
    updateReply,
    deleteReply,

    // Selection
    selectComment: setSelectedComment,

    // Utility functions
    getComment,
    getNearbyComments,
    updateBounds
  };
};

export default useComments;