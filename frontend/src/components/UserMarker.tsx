// Path: components\UserMarker.tsx
import React, { memo } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { User } from '../types';
import { useTheme } from '@mui/material';

interface UserMarkerProps {
  user: User;
  isSelf: boolean;
  socketId: string | undefined;
}

// Using React.memo to avoid unnecessary re-renders
const UserMarker: React.FC<UserMarkerProps> = memo(({ user, socketId: _socketId }) => {
  const theme = useTheme();
  
  // Ensure we have valid position data
  if (!user.position || typeof user.position.lng !== 'number' || typeof user.position.lat !== 'number') {
    console.warn("Invalid user position:", user);
    return null;
  }
  
  return (
    <Marker
      key={user.id}
      longitude={user.position.lng}
      latitude={user.position.lat}
      anchor="center"
    >
      <div>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: theme.palette.secondary.main,
            border: '2px solid white',
            boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
          }}
        />
        
        {/* Name label */}
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            left: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            padding: '3px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            boxShadow: '0px 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid',
            borderColor: theme.palette.secondary.main,
            zIndex: 2,
            pointerEvents: 'none'
          }}
        >
          {user.name}
        </div>
      </div>
    </Marker>
  );
});

// Add displayName for better debugging
UserMarker.displayName = 'UserMarker';

export default UserMarker;