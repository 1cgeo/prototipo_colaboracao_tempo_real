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
  ListItemAvatar,
  Avatar,
  CircularProgress
} from '@mui/material';
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Comment as CommentIcon,
  Reply as ReplyIcon
} from '@mui/icons-material';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { formatDistanceToNow } from 'date-fns';
import { useActivity } from '../../hooks';

const DRAWER_WIDTH = 300;

const SidePanel: React.FC = () => {
  const { currentRoom, users } = useCollaboration();

  const {
    activities,
    loading,
    hasMore,
    loadMore
  } = useActivity({
    roomId: currentRoom?.uuid || null
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
      case 'ROOM_JOIN':
      case 'ROOM_LEAVE':
        return <PersonIcon />;
      default:
        return <PersonIcon />;
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
          Active Users
        </Typography>
        <List>
          {users.map((user) => (
            <ListItem key={user.id}>
              <ListItemAvatar>
                <Avatar>
                  <PersonIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={user.displayName}
                secondary={`Joined ${formatDistanceToNow(new Date(user.joinedAt))} ago`}
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
        {loading ? (
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
                  primary={activity.userName}
                  secondary={
                    <>
                      {getActivityText(activity)}
                      {' • '}
                      {formatDistanceToNow(new Date(activity.timestamp))} ago
                    </>
                  }
                />
              </ListItem>
            ))}
            {hasMore && (
              <ListItem 
                component="li"
                onClick={loadMore} 
                disabled={loading}
                sx={{ justifyContent: 'center' }}
              >
                <Typography color="primary">
                  {loading ? 'Loading...' : 'Load More'}
                </Typography>
              </ListItem>
            )}
          </List>
        )}
      </Box>
    </Drawer>
  );
};

export default SidePanel;