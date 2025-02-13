import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  Button,
  Avatar
} from '@mui/material';
import {
  ExitToApp as ExitIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { stringToColor } from '../../components/UserBadge';

const TopBar: React.FC = () => {
  const { currentRoom, currentUser, users, leaveRoom } = useCollaboration();

  return (
    <AppBar position="fixed">
      <Toolbar>
        {/* App Title */}
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 2 }}>
          Mapa Colaborativo
        </Typography>

        {/* Room Info */}
        {currentRoom && (
          <>
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
              {currentRoom.name}
            </Typography>

            {/* Active Users Count */}
            <Box sx={{ mr: 2 }}>
              <Chip
                icon={<PeopleIcon />}
                label={`${users.length} online`}
                color="secondary"
                size="small"
              />
            </Box>

            {/* Current User */}
            <Box sx={{ mr: 2 }}>
              <Chip
                avatar={
                  <Avatar
                    sx={{
                      bgcolor: currentUser ? stringToColor(currentUser.user_id) : 'grey'
                    }}
                  >S
                    {currentUser?.display_name.charAt(0)}
                  </Avatar>
                }
                label={currentUser?.display_name || 'Unknown'}
                variant="outlined"
                color="default"
              />
            </Box>

            {/* Leave Room Button */}
            <Button
              color="inherit"
              startIcon={<ExitIcon />}
              onClick={leaveRoom}
            >
              Leave Room
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;