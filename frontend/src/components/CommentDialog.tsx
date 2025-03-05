// Path: components\CommentDialog.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useCommentStore } from '../store/useCommentStore';
import { Comment } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { commentFormSchema, replyFormSchema } from '../schemas/comment.schema';
import { ZodError } from 'zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  IconButton,
  Box,
  Stack
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  LocationOn as LocationIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { 
  updateComment, 
  deleteComment, 
  createReply, 
  updateReply, 
  deleteReply
} from '../api/comments';

interface CommentDialogProps {
  comment: Comment | null;
  onClose: () => void;
}

const CommentDialog: React.FC<CommentDialogProps> = ({ comment, onClose }) => {
  // Fix: Get currentUser directly instead of creating a new object
  const currentUser = useUserStore(state => state.currentUser);
  
  // Memoize any derived data we need
  const currentUserId = useMemo(() => currentUser?.id || '', [currentUser?.id]);
  const currentUserName = useMemo(() => currentUser?.name || '', [currentUser?.name]);
  
  const { 
    updateComment: updateCommentInStore, 
    deleteComment: deleteCommentInStore,
    addReply: addReplyInStore,
    updateReply: updateReplyInStore,
    deleteReply: deleteReplyInStore,
    setIsDraggingComment
  } = useCommentStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  
  useEffect(() => {
    if (comment) {
      setEditContent(comment.content);
    }
  }, [comment]);
  
  const updateCommentMutation = useMutation({
    mutationFn: ({ id, content }: { id: number, content: string }) => 
      updateComment(id, currentUserId, { content }),
    onSuccess: (updatedComment) => {
      updateCommentInStore(updatedComment);
      setIsEditing(false);
    }
  });
  
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId, currentUserId),
    onSuccess: (_, commentId) => {
      deleteCommentInStore(commentId);
      onClose();
    }
  });
  
  const createReplyMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: number, content: string }) => 
      createReply(commentId, currentUserId, currentUserName, { content }),
    onSuccess: (newReply, { commentId }) => {
      addReplyInStore(newReply, commentId);
      setReplyContent('');
      setReplyError(null);
    }
  });
  
  const updateReplyMutation = useMutation({
    mutationFn: ({ id, content }: { id: number, content: string }) => 
      updateReply(id, currentUserId, { content }),
    onSuccess: (updatedReply) => {
      updateReplyInStore(updatedReply, updatedReply.comment_id);
      setEditingReplyId(null);
    }
  });
  
  const deleteReplyMutation = useMutation({
    mutationFn: (replyId: number) => deleteReply(replyId, currentUserId),
    onSuccess: (_, replyId) => {
      if (comment) {
        deleteReplyInStore(replyId, comment.id);
      }
    }
  });
  
  const toggleMoveComment = () => {
    if (comment) {
      // Toggle dragging state
      setIsDraggingComment(comment.id);
      onClose();
    }
  };
  
  const handleUpdateComment = () => {
    if (!comment) return;
    
    setCommentError(null);
    try {
      // Validate with Zod schema
      const validData = commentFormSchema.parse({ content: editContent });
      updateCommentMutation.mutate({
        id: comment.id,
        content: validData.content
      });
    } catch (err) {
      if (err instanceof ZodError) {
        const contentError = err.errors.find(e => e.path.includes('content'));
        if (contentError) {
          setCommentError(contentError.message);
        }
      }
    }
  };
  
  const handleDeleteComment = () => {
    if (comment && window.confirm('Are you sure you want to delete this comment?')) {
      deleteCommentMutation.mutate(comment.id);
    }
  };
  
  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment) return;
    
    setReplyError(null);
    try {
      // Validate with Zod schema
      const validData = replyFormSchema.parse({ content: replyContent });
      createReplyMutation.mutate({
        commentId: comment.id,
        content: validData.content
      });
    } catch (err) {
      if (err instanceof ZodError) {
        const contentError = err.errors.find(e => e.path.includes('content'));
        if (contentError) {
          setReplyError(contentError.message);
        }
      }
    }
  };
  
  const handleUpdateReply = (replyId: number) => {
    try {
      // Validate with Zod schema
      const validData = replyFormSchema.parse({ content: editReplyContent });
      updateReplyMutation.mutate({
        id: replyId,
        content: validData.content
      });
    } catch (err) {
      // For simplicity, we're not showing the error on the UI for reply updates
      console.error('Invalid reply content:', err);
    }
  };
  
  const handleDeleteReply = (replyId: number) => {
    if (window.confirm('Are you sure you want to delete this reply?')) {
      deleteReplyMutation.mutate(replyId);
    }
  };
  
  if (!comment) return null;
  
  const isCommentAuthor = currentUserId === comment.user_id;
  
  return (
    <Dialog open={!!comment} onClose={onClose} maxWidth="sm" fullWidth>
      {/* FIX: DialogTitle already renders an h2, so we don't use Typography variant="h6" inside */}
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box component="div" sx={{ typography: 'subtitle1', fontWeight: 'bold' }}>
          Comment by {comment.user_name}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          {isEditing ? (
            <TextField
              fullWidth
              multiline
              rows={3}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              variant="outlined"
              error={!!commentError}
              helperText={commentError}
              sx={{ mb: 2 }}
            />
          ) : (
            <Typography variant="body1">{comment.content}</Typography>
          )}
          
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} mt={1}>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              {comment.created_at !== comment.updated_at && ' (edited)'}
            </Typography>
            
            {isCommentAuthor && (
              <Box>
                {isEditing ? (
                  <>
                    <Button size="small" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button 
                      size="small" 
                      variant="contained" 
                      onClick={handleUpdateComment}
                      disabled={updateCommentMutation.isPending}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <IconButton 
                      size="small" 
                      onClick={toggleMoveComment} 
                      title="Move Comment"
                    >
                      <LocationIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => setIsEditing(true)} 
                      title="Edit Comment"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={handleDeleteComment} 
                      title="Delete Comment"
                      disabled={deleteCommentMutation.isPending}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            )}
          </Stack>
          
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            Location: {comment.lng.toFixed(6)}, {comment.lat.toFixed(6)}
          </Typography>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Typography variant="subtitle2" gutterBottom>
          Replies ({comment.replies.length})
        </Typography>
        
        <List disablePadding>
          {comment.replies.map((reply) => (
            <ListItem
              key={reply.id}
              alignItems="flex-start"
              sx={{ 
                px: 0,
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                  {reply.user_name.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">{reply.user_name}</Typography>
                    
                    {currentUserId === reply.user_id && editingReplyId !== reply.id && (
                      <Box>
                        <IconButton 
                          size="small" 
                          onClick={() => {
                            setEditingReplyId(reply.id);
                            setEditReplyContent(reply.content);
                          }}
                          title="Edit Reply"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteReply(reply.id)}
                          title="Delete Reply"
                          disabled={deleteReplyMutation.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                }
                secondary={
                  <>
                    {editingReplyId === reply.id ? (
                      <Box mt={1}>
                        <TextField
                          fullWidth
                          size="small"
                          value={editReplyContent}
                          onChange={(e) => setEditReplyContent(e.target.value)}
                          variant="outlined"
                          multiline
                          sx={{ mb: 1 }}
                        />
                        <Box display="flex" justifyContent="flex-end" gap={1}>
                          <Button 
                            size="small" 
                            onClick={() => setEditingReplyId(null)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="small" 
                            variant="contained" 
                            onClick={() => handleUpdateReply(reply.id)}
                            disabled={updateReplyMutation.isPending}
                          >
                            Save
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <>
                        <Typography variant="body2" component="span">
                          {reply.content}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                          {reply.created_at !== reply.updated_at && ' (edited)'}
                        </Typography>
                      </>
                    )}
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
        
        <Box component="form" onSubmit={handleSubmitReply} sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            variant="outlined"
            error={!!replyError}
            helperText={replyError}
          />
          <Button 
            type="submit" 
            variant="contained" 
            disabled={!replyContent.trim() || createReplyMutation.isPending}
            endIcon={<SendIcon />}
          >
            Reply
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CommentDialog;