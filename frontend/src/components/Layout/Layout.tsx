import React from 'react';
import { Box, CssBaseline } from '@mui/material';
import { useCollaboration } from '../../contexts/CollaborationContext';
import TopBar from './TopBar';
import SidePanel from './SidePanel';
import { RoomManager } from '../Rooms';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentRoom } = useCollaboration();

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <CssBaseline />
      
      {/* Top Bar - Always visible */}
      <TopBar />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: '100vh',
          overflow: 'hidden',
          position: 'relative',
          marginTop: '64px', // Height of TopBar
          display: 'flex'
        }}
      >
        {/* Center Panel for Room Management - Only visible when not in a room */}
        {!currentRoom && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              maxWidth: '600px',
              p: 3,
              zIndex: 1
            }}
          >
            <RoomManager />
          </Box>
        )}

        {/* Side Panel - Only visible when in a room */}
        {currentRoom && <SidePanel />}

        {/* Map Container */}
        <Box
          sx={{
            flexGrow: 1,
            height: '100%',
            position: 'relative'
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;