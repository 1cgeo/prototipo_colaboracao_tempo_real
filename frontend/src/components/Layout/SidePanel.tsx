import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Button,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Comment as CommentIcon,
  Reply as ReplyIcon
} from '@mui/icons-material';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { formatDistanceToNow } from 'date-fns';
import { useActivity } from '../../hooks';
import { UserBadge } from '../UserBadge';

const DRAWER_WIDTH = 300;

const SidePanel: React.FC = () => {
  const { currentRoom, users, getUserDisplayName } = useCollaboration();

  const {
    activities,
    loading,
    hasMore,
    loadMore
  } = useActivity({
    roomId: currentRoom?.uuid || null,
    limit: 50
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'COMMENT_CREATE':
        return <CommentIcon />;
      case 'COMMENT_UPDATE':
        return <EditIcon />;
      case 'COMMENT_DELETE':
        return <DeleteIcon />;
      case 'REPLY_CREATE':
        return <ReplyIcon />;
      case 'REPLY_UPDATE':
        return <EditIcon />;
      case 'REPLY_DELETE':
        return <DeleteIcon />;
      default:
        return null;
    }
  };

  const getActivityText = (activity: typeof activities[0]) => {
    switch (activity.type) {
      case 'ROOM_JOIN':
        return `joined the room`;
      case 'ROOM_LEAVE':
        return `left the room`;
      case 'COMMENT_CREATE':
        return `added a comment`;
      case 'COMMENT_UPDATE':
        return `updated a comment`;
      case 'COMMENT_DELETE':
        return `deleted a comment`;
      case 'REPLY_CREATE':
        return `replied to a comment`;
      case 'REPLY_UPDATE':
        return `updated a reply`;
      case 'REPLY_DELETE':
        return `deleted a reply`;
      default:
        return `performed an action`;
    }
  };

  return (
    <Drawer
      variant="permanent"
      anchor="right"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          marginTop: '64px', // Height of TopBar
          height: 'calc(100% - 64px)',
        },
      }}
    >
      {/* Active Users Section */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Active Users ({users.length})
        </Typography>
        <List>
          {users.map((user) => (
            <ListItem key={user.id}>
              <UserBadge
                userId={user.id}
                displayName={user.display_name}
                size="medium"
                showTooltip={false}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider />

      {/* Activity Log Section */}
      <Box sx={{ p: 2, overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          Activity Log
        </Typography>
        {loading && !activities.length ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {activities.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemIcon>
                  {getActivityIcon(activity.type)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <UserBadge
                      userId={activity.user_id}
                      displayName={getUserDisplayName(activity.user_id)}
                      size="small"
                      abbreviated
                    />
                  }
                  secondary={
                    <>
                      {getActivityText(activity)}
                      {' • '}
                      {formatDistanceToNow(new Date(activity.created_at))} ago
                    </>
                  }
                />
              </ListItem>
            ))}
            {hasMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button
                  onClick={loadMore}
                  disabled={loading}
                  variant="text"
                  color="primary"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              </Box>
            )}
          </List>
        )}
      </Box>
    </Drawer>
  );
};

export default SidePanel;