import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Box,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
  Place as PlaceIcon
} from '@mui/icons-material';
import { Comment } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { UserBadge } from '../UserBadge';
import { useCollaboration } from '../../contexts/CollaborationContext';

interface CommentItemProps {
  comment: Comment;
  showLocation?: boolean;
  showActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onLocationClick?: (event: React.MouseEvent) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  showLocation = false,
  showActions = true,
  onEdit,
  onDelete,
  onReply,
  onLocationClick
}) => {
  const { getUserDisplayName } = useCollaboration();

  const formatCoordinates = (coordinates: [number, number]) => {
    const [lng, lat] = coordinates;
    return `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              {comment.content}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <UserBadge
                userId={comment.author_id}
                displayName={getUserDisplayName(comment.author_id)}
                size="small"
                abbreviated
              />
              <Typography variant="caption" color="textSecondary">
                • {formatDistanceToNow(new Date(comment.created_at))} ago
              </Typography>
            </Box>
          </Box>
          {showLocation && onLocationClick && (
            <Tooltip title={formatCoordinates(comment.location.coordinates)}>
              <IconButton
                size="small"
                onClick={onLocationClick}
                sx={{ ml: 1 }}
              >
                <PlaceIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {comment.replies.length > 0 && (
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </Typography>
        )}
      </CardContent>

      {showActions && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
          {onReply && (
            <Tooltip title="Reply">
              <IconButton size="small" onClick={onReply}>
                <ReplyIcon />
              </IconButton>
            </Tooltip>
          )}
          {onEdit && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={onEdit}>
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete">
              <IconButton size="small" onClick={onDelete}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </CardActions>
      )}
    </Card>
  );
};

export default CommentItem;