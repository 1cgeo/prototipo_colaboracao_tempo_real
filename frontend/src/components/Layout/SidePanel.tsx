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
  CircularProgress,
  Avatar
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Comment as CommentIcon,
  Reply as ReplyIcon,
  PersonAdd as JoinIcon,
  ExitToApp as LeaveIcon
} from '@mui/icons-material';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { formatDistanceToNow } from 'date-fns';
import { useActivity } from '../../hooks';
import { ActivityType } from '../../types';
import { stringToColor } from '../../components/UserBadge';

const DRAWER_WIDTH = 300;

const ActivityIcon: React.FC<{ type: ActivityType }> = ({ type }) => {
  switch (type) {
    case 'COMMENT_CREATED':
      return <CommentIcon />;
    case 'COMMENT_UPDATED':
      return <EditIcon />;
    case 'COMMENT_DELETED':
      return <DeleteIcon />;
    case 'REPLY_CREATED':
      return <ReplyIcon />;
    case 'REPLY_UPDATED':
      return <EditIcon />;
    case 'REPLY_DELETED':
      return <DeleteIcon />;
    case 'USER_JOINED':
      return <JoinIcon />;
    case 'USER_LEFT':
      return <LeaveIcon />;
    default:
      return null;
  }
};

const ActivityMessage: React.FC<{ type: ActivityType }> = ({ type }) => {
  switch (type) {
    case 'USER_JOINED':
      return <>joined the room</>;
    case 'USER_LEFT':
      return <>left the room</>;
    case 'COMMENT_CREATED':
      return <>added a comment</>;
    case 'COMMENT_UPDATED':
      return <>updated a comment</>;
    case 'COMMENT_DELETED':
      return <>deleted a comment</>;
    case 'REPLY_CREATED':
      return <>replied to a comment</>;
    case 'REPLY_UPDATED':
      return <>updated a reply</>;
    case 'REPLY_DELETED':
      return <>deleted a reply</>;
    default:
      return <>performed an action</>;
  }
};

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
              <ListItemIcon>
                <Avatar
                  sx={{
                    bgcolor: stringToColor(user.id),
                    width: 32,
                    height: 32,
                    fontSize: '0.875rem'
                  }}
                >
                  {user.display_name.charAt(0)}
                </Avatar>
              </ListItemIcon>
              <ListItemText 
                primary={user.display_name}
                secondary={formatDistanceToNow(new Date(user.joined_at), { addSuffix: true })}
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
                  <ActivityIcon type={activity.type} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        sx={{
                          bgcolor: stringToColor(activity.user_id),
                          width: 24,
                          height: 24,
                          fontSize: '0.75rem'
                        }}
                      >
                        {activity.user_name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2">
                        {getUserDisplayName(activity.user_id)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <ActivityMessage type={activity.type} />
                      {' • '}
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
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