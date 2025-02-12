import { useCallback } from 'react';
import { 
  Comment,
  Reply,
  ReplyCreateEvent,
  ReplyUpdateEvent,
  ReplyDeleteEvent
} from '../../types';
import { useVersioning } from './useVersioning';

interface UseReplyEventsProps {
  setComments: (updater: (comments: Comment[]) => Comment[]) => void;
}

export const useReplyEvents = ({ 
  setComments 
}: UseReplyEventsProps) => {
  const versioning = useVersioning();

  const handleReplyCreate = useCallback((event: ReplyCreateEvent) => {
    const newReply: Reply = {
      id: event.user_id,
      content: event.content,
      author_id: event.user_id,
      author_name: '', // Will be updated when server confirms
      version: 1,
      created_at: new Date(event.timestamp).toISOString(),
      updated_at: new Date(event.timestamp).toISOString()
    };

    setComments(prev => prev.map(comment => {
      if (comment.id === event.comment_id) {
        return {
          ...comment,
          replies: [...comment.replies, newReply]
        };
      }
      return comment;
    }));
  }, [setComments]);

  const handleReplyUpdate = useCallback((event: ReplyUpdateEvent) => {
    const pendingChange = versioning.getPendingChange('reply', event.reply_id);
    if (pendingChange && pendingChange.version >= event.version) {
      return; // Ignore outdated updates
    }

    setComments(prev => prev.map(comment => {
      if (comment.id === event.comment_id) {
        return {
          ...comment,
          replies: comment.replies.map(reply => {
            if (reply.id === event.reply_id) {
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

    versioning.trackVersion('reply', event.reply_id, event.version);
  }, [versioning, setComments]);

  const handleReplyDelete = useCallback((event: ReplyDeleteEvent) => {
    const pendingChange = versioning.getPendingChange('reply', event.reply_id);
    if (pendingChange && pendingChange.version >= event.version) {
      return; // Ignore outdated deletes
    }

    setComments(prev => prev.map(comment => {
      if (comment.id === event.comment_id) {
        return {
          ...comment,
          replies: comment.replies.filter(r => r.id !== event.reply_id)
        };
      }
      return comment;
    }));

    versioning.removeVersionTracking('reply', event.reply_id);
  }, [versioning, setComments]);

  return {
    handleReplyCreate,
    handleReplyUpdate,
    handleReplyDelete
  };
};