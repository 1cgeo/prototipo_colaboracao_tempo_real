import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  ButtonBase
} from '@mui/material';
import { Comment } from '../../types';
import { CommentItem } from '../Comments';

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
    <Box sx={{ p: 2 }}>
      {comments.map((comment) => (
        <ButtonBase
          key={comment.id}
          onClick={() => onSelectComment(comment)}
          sx={{ width: '100%', textAlign: 'left', mb: 2, display: 'block' }}
        >
          <CommentItem
            comment={comment}
            showLocation={true}
            showActions={true}
            onEdit={() => onEditComment(comment)}
            onDelete={() => onDeleteComment(comment)}
            onReply={() => onReplyComment(comment)}
            onLocationClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              onSelectComment(comment);
            }}
          />
        </ButtonBase>
      ))}
    </Box>
  );
};

export default CommentList;