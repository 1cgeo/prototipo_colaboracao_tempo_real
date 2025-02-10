import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  IconButton,
  Button,
  TextField,
  Divider,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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

interface CommentDetailProps {
  comment: Comment;
  onClose: () => void;
}

interface DialogState {
  type: 'edit-comment' | 'edit-reply' | 'reply';
  open: boolean;
  replyId?: string;
}

const CommentDetail: React.FC<CommentDetailProps> = ({ comment, onClose }) => {
  const { currentRoom } = useCollaboration();
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
  const handleCreateReply = async () => {
    if (!currentRoom) return;
    setLoading(true);

    try {
      await replyApi.create(currentRoom.uuid, comment.id, { content });
      setDialogState({ type: 'reply', open: false });
      setContent('');
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  // Handle reply edit
  const handleEditReply = async () => {
    if (!currentRoom || !dialogState.replyId) return;
    setLoading(true);

    try {
      const reply = comment.replies.find(r => r.id === dialogState.replyId);
      if (!reply) return;

      await replyApi.update(currentRoom.uuid, comment.id, reply.id, {
        content,
        version: reply.version
      });
      setDialogState({ type: 'reply', open: false });
      setContent('');
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  // Handle reply delete
  const handleDeleteReply = async (replyId: string) => {
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

  // Handle dialog close
  const handleDialogClose = () => {
    setDialogState({ type: 'reply', open: false });
    setContent('');
    setError(null);
  };

  // Handle dialog submit
  const handleDialogSubmit = async () => {
    switch (dialogState.type) {
      case 'edit-comment':
        await handleEditComment();
        break;
      case 'edit-reply':
        await handleEditReply();
        break;
      case 'reply':
        await handleCreateReply();
        break;
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
        <Typography variant="caption" color="text.secondary">
          By {comment.authorName} • {formatDistanceToNow(new Date(comment.createdAt))} ago
        </Typography>

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
              setContent('');
              setDialogState({ type: 'reply', open: true });
            }}
          >
            <ReplyIcon />
          </IconButton>
        </Box>

        {/* Replies Section */}
        {comment.replies.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Replies
            </Typography>
            <List>
              {comment.replies.map((reply) => (
                <ListItem key={reply.id}>
                  <ListItemText
                    primary={reply.content}
                    secondary={
                      <>
                        By {reply.authorName} •{' '}
                        {formatDistanceToNow(new Date(reply.createdAt))} ago
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => {
                        setContent(reply.content);
                        setDialogState({
                          type: 'edit-reply',
                          open: true,
                          replyId: reply.id
                        });
                      }}
                      sx={{ mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDeleteReply(reply.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </>
        )}

        {/* Error Display */}
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            Error: {error.message}
          </Typography>
        )}
      </CardContent>

      {/* Dialog for Edit/Reply */}
      <Dialog
        open={dialogState.open}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogState.type === 'edit-comment' ? 'Edit Comment' :
           dialogState.type === 'edit-reply' ? 'Edit Reply' :
           'Add Reply'}
        </DialogTitle>
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
          {error && (
            <Typography color="error" sx={{ mt: 1 }}>
              Error: {error.message}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDialogSubmit}
            variant="contained"
            disabled={loading || !content.trim()}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              dialogState.type === 'edit-comment' ? 'Update Comment' :
              dialogState.type === 'edit-reply' ? 'Update Reply' :
              'Add Reply'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default CommentDetail;