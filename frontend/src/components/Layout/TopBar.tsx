import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  Button
} from '@mui/material';
import {
  ExitToApp as ExitIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useCollaboration } from '../../contexts/CollaborationContext';

const TopBar: React.FC = () => {
  const { currentRoom, users, leaveRoom } = useCollaboration();

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