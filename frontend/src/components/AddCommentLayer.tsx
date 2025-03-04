// Path: components\AddCommentLayer.tsx
import React, { useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useCommentStore } from '../store/useCommentStore';
import { useMutation } from '@tanstack/react-query';
import { createComment } from '../api/comments';
import { commentFormSchema } from '../schemas/comment.schema';
import { ZodError } from 'zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  IconButton,
  Box
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  PushPin as PushPinIcon
} from '@mui/icons-material';

interface AddCommentLayerProps {
  mapId: number;
  position: { lng: number, lat: number } | null;
  onClose: () => void;
}

const AddCommentLayer: React.FC<AddCommentLayerProps> = ({ 
  mapId, 
  position, 
  onClose 
}) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useUserStore();
  const { addComment } = useCommentStore();
  
  const createCommentMutation = useMutation({
    mutationFn: (data: { content: string }) => {
      if (!currentUser || !position) {
        throw new Error('Missing user or position data');
      }
      return createComment(
        mapId,
        currentUser.id,
        currentUser.name,
        position,
        data
      );
    },
    onSuccess: (newComment) => {
      addComment(newComment);
      onClose();
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      // Validate the comment content using the schema
      const validatedData = commentFormSchema.parse({ content });
      createCommentMutation.mutate(validatedData);
    } catch (err) {
      if (err instanceof ZodError) {
        // Extract the error message for the content field
        const contentError = err.errors.find(e => e.path.includes('content'));
        if (contentError) {
          setError(contentError.message);
        } else {
          setError('Invalid comment content');
        }
      } else {
        setError('An error occurred while creating your comment');
      }
    }
  };
  
  if (!position) return null;
  
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <PushPinIcon color="primary" />
          <Typography variant="h6">Add Comment</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Typography variant="caption" display="block" mb={1}>
            At coordinates: {position.lng.toFixed(6)}, {position.lat.toFixed(6)}
          </Typography>
          
          <TextField
            fullWidth
            label="Comment"
            multiline
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            variant="outlined"
            required
            autoFocus
            error={!!error}
            helperText={error}
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            type="submit" 
            variant="contained" 
            endIcon={<SendIcon />}
            disabled={!content.trim() || createCommentMutation.isPending}
          >
            {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddCommentLayer;