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

// Generate random display name
const generateDisplayName = (): string => {
  const firstNames = [
    'Alex', 'Blake', 'Casey', 'Drew', 'Eden',
    'Finn', 'Gray', 'Harley', 'Indigo', 'Jamie'
  ];
  const lastNames = [
    'Smith', 'Jones', 'Brown', 'Taylor', 'Wilson',
    'Davis', 'Miller', 'Moore', 'Clark', 'Lee'
  ];

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

  return `${firstName} ${lastName}`;
};

// Get or create persistent userId and displayName
const getUserInfo = (): { userId: string; displayName: string } => {
  const stored = localStorage.getItem('userInfo');
  if (stored) {
    return JSON.parse(stored);
  }

  const newInfo = {
    userId: uuidv4(),
    displayName: generateDisplayName()
  };
  localStorage.setItem('userInfo', JSON.stringify(newInfo));
  return newInfo;
};

const AppContent: React.FC = () => {
  const [{ userId, displayName }] = useState(getUserInfo);
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
    <CollaborationProvider userId={userId} displayName={displayName}>
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