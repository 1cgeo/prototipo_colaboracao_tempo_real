import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { v4 as uuidv4 } from 'uuid';
import { CircularProgress, Box } from '@mui/material';
import { CollaborationProvider } from './contexts/CollaborationContext';
import { MapProvider } from './contexts/MapContext';
import { Layout } from './components/Layout';
import { MapView } from './components/Map';
import { SnackbarProvider, useSnackbar } from 'notistack';

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

// Get or create persistent userId
const getUserId = (): string => {
  const stored = localStorage.getItem('userId');
  if (stored) return stored;

  const newId = uuidv4();
  localStorage.setItem('userId', newId);
  return newId;
};

const AppContent: React.FC = () => {
  const [userId] = useState(getUserId);
  const [initializing, setInitializing] = useState(true);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Authentication will be handled by CollaborationProvider
        setInitializing(false);
      } catch (error) {
        enqueueSnackbar('Failed to initialize user session', { 
          variant: 'error',
          preventDuplicate: true
        });
        console.error('Initialization error:', error);
      }
    };

    initializeUser();
  }, [enqueueSnackbar]);

  if (initializing) {
    return (
      <Box 
        sx={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <CollaborationProvider userId={userId}>
      <MapProvider>
        <Layout>
          <MapView />
        </Layout>
      </MapProvider>
    </CollaborationProvider>
  );
};

const App: React.FC = () => {
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