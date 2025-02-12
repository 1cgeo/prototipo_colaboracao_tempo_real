import { useCallback } from 'react';
import { 
  Comment,
  CommentCreateEvent,
  CommentUpdateEvent,
  CommentDeleteEvent,
  MapBounds
} from '../../types';
import { useVersioning } from './useVersioning';

interface UseCommentEventsProps {
  bounds: MapBounds | null;
  setComments: (updater: (comments: Comment[]) => Comment[]) => void;
  setSelectedComment: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useCommentEvents = ({ 
  bounds,
  setComments,
  setSelectedComment
}: UseCommentEventsProps) => {
  const versioning = useVersioning();

  const handleCommentCreate = useCallback((event: CommentCreateEvent) => {
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

    const newComment: Comment = {
      id: event.user_id,
      content: event.content,
      location: event.location,
      author_id: event.user_id,
      author_name: '', // Will be updated when server confirms
      version: 1,
      created_at: new Date(event.timestamp).toISOString(),
      updated_at: new Date(event.timestamp).toISOString(),
      replies: []
    };

    setComments(prev => [...prev, newComment]);
  }, [bounds, setComments]);

  const handleCommentUpdate = useCallback((event: CommentUpdateEvent) => {
    const pendingChange = versioning.getPendingChange('comment', event.comment_id);
    if (pendingChange && pendingChange.version >= event.version) {
      return; // Ignore outdated updates
    }

    setComments(prev => prev.map(comment => {
      if (comment.id === event.comment_id) {
        return {
          ...comment,
          content: event.content,
          version: event.version,
          updated_at: new Date(event.timestamp).toISOString()
        };
      }
      return comment;
    }));

    versioning.trackVersion('comment', event.comment_id, event.version);
  }, [versioning, setComments]);

  const handleCommentDelete = useCallback((event: CommentDeleteEvent) => {
    const pendingChange = versioning.getPendingChange('comment', event.comment_id);
    if (pendingChange && pendingChange.version >= event.version) {
      return; // Ignore outdated deletes
    }

    setComments(prev => prev.filter(c => c.id !== event.comment_id));
    setSelectedComment(currentCommentId => 
      currentCommentId === event.comment_id ? null : currentCommentId
    );
    
    versioning.removeVersionTracking('comment', event.comment_id);
  }, [versioning, setComments, setSelectedComment]);

  return {
    handleCommentCreate,
    handleCommentUpdate,
    handleCommentDelete
  };
};