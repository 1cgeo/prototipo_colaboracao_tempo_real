import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import { CollaborationProvider } from './contexts/CollaborationContext';
import { MapProvider } from './contexts/MapContext';
import { Layout } from './components/Layout';
import { MapView } from './components/Map';
import { SnackbarProvider } from 'notistack';
import { getUserInfo } from './services/auth';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const AppContent: React.FC = () => {
  const [initializing, setInitializing] = useState(true);
  const [userInfo, setUserInfo] = useState<{ userId: string; displayName: string } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      console.log('[App] Starting user initialization');
      try {
        const info = getUserInfo();
        console.log('[App] Retrieved user info:', info);
        
        if (!info || !info.userId) {
          throw new Error('Invalid user info received');
        }

        setUserInfo(info);
        setInitializing(false);
        console.log('[App] User initialization completed');
      } catch (error) {
        console.error('[App] Failed to initialize user:', error);
        setError(error as Error);
        setInitializing(false);
      }
    };

    initializeUser();
  }, []);

  if (initializing) {
    console.log('[App] Rendering loading state');
    return (
      <Box 
        sx={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <CircularProgress />
        <Box sx={{ color: 'text.secondary' }}>Initializing application...</Box>
      </Box>
    );
  }

  if (error) {
    console.error('[App] Rendering error state:', error);
    return (
      <Box 
        sx={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          color: 'error.main'
        }}
      >
        <div>Error initializing application: {error.message}</div>
      </Box>
    );
  }

  if (!userInfo) {
    console.error('[App] No user info available after initialization');
    return (
      <Box 
        sx={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          color: 'error.main'
        }}
      >
        <div>Failed to load user information</div>
      </Box>
    );
  }

  console.log('[App] Rendering main application with user:', userInfo.userId);
  return (
    <CollaborationProvider userId={userInfo.userId}>
      <MapProvider>
        <Layout>
          <MapView />
        </Layout>
      </MapProvider>
    </CollaborationProvider>
  );
};

const App: React.FC = () => {
  console.log('[App] Initial render');
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <AppContent />
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;