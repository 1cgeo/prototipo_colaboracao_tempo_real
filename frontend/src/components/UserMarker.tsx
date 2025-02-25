import React from 'react';
import { Marker } from 'react-map-gl';
import { User } from '../types';
import { Box, useTheme } from '@mui/material';

interface UserMarkerProps {
  user: User;
  isSelf: boolean;
  socketId: string | undefined;
}

const UserMarker: React.FC<UserMarkerProps> = ({ user, isSelf, socketId }) => {
  const theme = useTheme();
  
  return (
    <Marker
      key={user.id}
      longitude={user.position.lng}
      latitude={user.position.lat}
    >
      <Box sx={{ position: 'relative' }}>
        {/* User cursor dot */}
        <Box 
          sx={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            bgcolor: user.id === socketId ? theme.palette.primary.main : theme.palette.secondary.main,
            border: '2px solid white',
            transform: 'translate(-50%, -50%)',
            boxShadow: 2,
            zIndex: 1
          }}
        />
        
        {/* Name label */}
        <Box
          sx={{
            position: 'absolute',
            top: -10,
            left: 10,
            bgcolor: 'rgba(255, 255, 255, 0.85)',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: 12,
            whiteSpace: 'nowrap',
            boxShadow: 1,
            border: '1px solid',
            borderColor: user.id === socketId ? theme.palette.primary.main : theme.palette.secondary.main,
            zIndex: 2
          }}
        >
          {user.name} {isSelf ? '(You)' : ''}
        </Box>
      </Box>
    </Marker>
  );
};

export default UserMarker;