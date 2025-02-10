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
import { CommentCreateInput, Point } from '../../types';

interface CommentCreateProps {
  open: boolean;
  loading: boolean;
  error: Error | null;
  location: Point;
  onClose: () => void;
  onSubmit: (input: CommentCreateInput) => Promise<void>;
}

const CommentCreate: React.FC<CommentCreateProps> = ({
  open,
  loading,
  error,
  location,
  onClose,
  onSubmit
}) => {
  const [content, setContent] = useState('');

  const handleSubmit = async () => {
    try {
      await onSubmit({
        content,
        location
      });
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

  const formatCoordinates = (location: Point) => {
    const [lng, lat] = location.coordinates;
    return `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Add Comment</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}
        <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
          Location: {formatCoordinates(location)}
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="Comment"
          type="text"
          fullWidth
          multiline
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading}
          error={Boolean(error)}
          helperText={error?.message}
          placeholder="What would you like to say about this location?"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !content.trim()}
        >
          {loading ? <CircularProgress size={24} /> : 'Add Comment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CommentCreate;