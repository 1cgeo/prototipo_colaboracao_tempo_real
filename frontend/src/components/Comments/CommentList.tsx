import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  ButtonBase
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon
} from '@mui/icons-material';
import { Comment } from '../../types';
import { formatDistanceToNow } from 'date-fns';

interface CommentListProps {
  comments: Comment[];
  loading: boolean;
  error: Error | null;
  onSelectComment: (comment: Comment) => void;
  onEditComment: (comment: Comment) => void;
  onDeleteComment: (comment: Comment) => void;
  onReplyComment: (comment: Comment) => void;
}

const CommentList: React.FC<CommentListProps> = ({
  comments,
  loading,
  error,
  onSelectComment,
  onEditComment,
  onDeleteComment,
  onReplyComment
}) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" sx={{ p: 2 }}>
        Error loading comments: {error.message}
      </Typography>
    );
  }

  if (comments.length === 0) {
    return (
      <Typography color="textSecondary" sx={{ p: 2 }}>
        No comments yet. Click on the map to add one!
      </Typography>
    );
  }

  return (
    <List>
      {comments.map((comment) => (
        <Box key={comment.id}>
          <ButtonBase
            onClick={() => onSelectComment(comment)}
            sx={{ width: '100%', textAlign: 'left' }}
          >
            <ListItem
              sx={{
                mb: 1,
                borderRadius: 1,
                width: '100%',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
              }}
            >
              <ListItemText
                primary={comment.content}
                secondary={
                  <>
                    By {comment.authorName} •{' '}
                    {formatDistanceToNow(new Date(comment.createdAt))} ago
                    {comment.replies.length > 0 && (
                      <> • {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</>
                    )}
                  </>
                }
                primaryTypographyProps={{
                  sx: {
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }
                }}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplyComment(comment);
                  }}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  <ReplyIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditComment(comment);
                  }}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteComment(comment);
                  }}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          </ButtonBase>
        </Box>
      ))}
    </List>
  );
};

export default CommentList;