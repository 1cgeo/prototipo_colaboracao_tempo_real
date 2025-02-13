import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Typography,
  Alert
} from '@mui/material';
import { Comment, ReplyCreateInput } from '../../types';
import { useCollaboration } from '../../contexts/CollaborationContext';

interface ReplyCreateProps {
  open: boolean;
  loading: boolean;
  error: Error | null;
  comment: Comment;
  onClose: () => void;
  onSubmit: (input: ReplyCreateInput) => Promise<void>;
}

const ReplyCreate: React.FC<ReplyCreateProps> = ({
  open,
  loading,
  error,
  comment,
  onClose,
  onSubmit
}) => {
  const [content, setContent] = useState('');
  const { getUserDisplayName } = useCollaboration();

  const handleSubmit = async () => {
    try {
      await onSubmit({ content });
      setContent('');
      onClose();
    } catch {
      // Error will be handled by parent component
    }
  };

  const handleClose = () => {
    setContent('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Responder um comentário</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}
        {/* Original comment display */}
        <Typography
          variant="body2"
          sx={{
            mb: 2,
            p: 2,
            backgroundColor: 'grey.100',
            borderRadius: 1,
            fontStyle: 'italic'
          }}
        >
          "{comment.content}"
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            - {getUserDisplayName(comment.author_id)}
          </Typography>
        </Typography>

        {/* Reply input */}
        <TextField
          autoFocus
          margin="dense"
          label="Sua Resposta"
          type="text"
          fullWidth
          multiline
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading}
          error={Boolean(error)}
          helperText={error?.message}
          placeholder="Escreva sua resposta..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
        Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !content.trim()}
        >
          {loading ? <CircularProgress size={24} /> : 'Responder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReplyCreate;