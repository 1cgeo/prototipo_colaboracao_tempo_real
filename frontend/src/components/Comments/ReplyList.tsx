import React from 'react';
import {
  List,
  ListItem,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { Reply } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { UserBadge } from '../UserBadge';
import { useCollaboration } from '../../contexts/CollaborationContext';

interface ReplyListProps {
  replies: Reply[];
  onEditReply: (reply: Reply) => void;
  onDeleteReply: (reply: Reply) => void;
}

const ReplyList: React.FC<ReplyListProps> = ({
  replies,
  onEditReply,
  onDeleteReply
}) => {
  const { getUserDisplayName } = useCollaboration();

  if (replies.length === 0) {
    return (
      <Typography color="textSecondary" variant="body2" sx={{ mt: 2, mb: 1 }}>
        No replies yet.
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Divider />
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
        Replies
      </Typography>
      <List>
        {replies.map((reply) => (
          <ListItem
            key={reply.id}
            sx={{
              px: 0,
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                borderRadius: 1
              }
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {reply.content}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <UserBadge
                  userId={reply.authorId}
                  displayName={getUserDisplayName(reply.authorId)}
                  size="small"
                  abbreviated
                />
                <Typography variant="caption" color="text.secondary">
                  • {formatDistanceToNow(new Date(reply.createdAt))} ago
                </Typography>
              </Box>
            </Box>
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={() => onEditReply(reply)}
                size="small"
                sx={{ mr: 1 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                edge="end"
                onClick={() => onDeleteReply(reply)}
                size="small"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default ReplyList;