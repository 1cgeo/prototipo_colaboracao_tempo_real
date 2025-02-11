import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  IconButton,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { Comment } from '../../types';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { commentApi, replyApi } from '../../utils/api';
import { ReplyList, ReplyCreate } from '../Comments';
import { UserBadge } from '../UserBadge';

interface CommentDetailProps {
  comment: Comment;
  onClose: () => void;
}

interface DialogState {
  type: 'edit-comment' | 'reply';
  open: boolean;
}

const CommentDetail: React.FC<CommentDetailProps> = ({ comment, onClose }) => {
  const { currentRoom, getUserDisplayName } = useCollaboration();
  const [dialogState, setDialogState] = useState<DialogState>({
    type: 'reply',
    open: false
  });
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Handle comment edit
  const handleEditComment = async () => {
    if (!currentRoom) return;
    setLoading(true);

    try {
      await commentApi.update(currentRoom.uuid, comment.id, {
        content,
        version: comment.version
      });
      setDialogState({ type: 'reply', open: false });
      setContent('');
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  // Handle comment delete
  const handleDeleteComment = async () => {
    if (!currentRoom) return;
    setLoading(true);

    try {
      await commentApi.delete(currentRoom.uuid, comment.id);
      onClose();
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  // Handle reply create
  const handleReplyCreate = async (content: string) => {
    if (!currentRoom) return;
    setLoading(true);

    try {
      await replyApi.create(currentRoom.uuid, comment.id, { content });
      setDialogState({ type: 'reply', open: false });
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Handle reply update
  const handleReplyUpdate = async (replyId: string, content: string, version: number) => {
    if (!currentRoom) return;
    setLoading(true);

    try {
      await replyApi.update(currentRoom.uuid, comment.id, replyId, {
        content,
        version
      });
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Handle reply delete
  const handleReplyDelete = async (replyId: string) => {
    if (!currentRoom) return;
    setLoading(true);

    try {
      await replyApi.delete(currentRoom.uuid, comment.id, replyId);
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ 
      position: 'absolute', 
      bottom: 20, 
      right: 20, 
      width: 400,
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {/* Comment Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Comment
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Comment Content */}
        <Typography variant="body1" gutterBottom>
          {comment.content}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <UserBadge
            userId={comment.authorId}
            displayName={getUserDisplayName(comment.authorId)}
            size="small"
          />
          <Typography variant="caption" color="text.secondary">
            • {formatDistanceToNow(new Date(comment.createdAt))} ago
          </Typography>
        </Box>

        {/* Comment Actions */}
        <Box sx={{ mt: 2 }}>
          <IconButton
            size="small"
            onClick={() => {
              setContent(comment.content);
              setDialogState({ type: 'edit-comment', open: true });
            }}
          >
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleDeleteComment}
          >
            <DeleteIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setDialogState({ type: 'reply', open: true });
            }}
          >
            <ReplyIcon />
          </IconButton>
        </Box>

        {/* Replies Section */}
        <ReplyList
          replies={comment.replies}
          onEditReply={(reply) => handleReplyUpdate(reply.id, reply.content, reply.version)}
          onDeleteReply={(reply) => handleReplyDelete(reply.id)}
        />

        {/* Error Display */}
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            Error: {error.message}
          </Typography>
        )}
      </CardContent>

      {/* Edit Comment Dialog */}
      <Dialog
        open={dialogState.type === 'edit-comment' && dialogState.open}
        onClose={() => setDialogState({ type: 'reply', open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Comment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Content"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDialogState({ type: 'reply', open: false })}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditComment}
            variant="contained"
            disabled={loading || !content.trim()}
          >
            {loading ? <CircularProgress size={24} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reply Create Dialog */}
      <ReplyCreate
        open={dialogState.type === 'reply' && dialogState.open}
        loading={loading}
        error={error}
        comment={comment}
        onClose={() => setDialogState({ type: 'reply', open: false })}
        onSubmit={({ content }) => handleReplyCreate(content)}
      />
    </Card>
  );
};

export default CommentDetail;