import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { v4 as uuidv4 } from 'uuid';
import { CollaborationProvider } from './contexts/CollaborationContext';
import { MapProvider } from './contexts/MapContext';
import { Layout } from './components/Layout';
import { MapView } from './components/Map';
import { SnackbarProvider } from 'notistack';
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

// Mock user data (in a real app, this would come from authentication)
const mockUser = {
  id: uuidv4(),
  displayName: `User-${Math.floor(Math.random() * 1000)}`
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <CollaborationProvider userId={mockUser.id} displayName={mockUser.displayName}>
          <MapProvider>
            <Layout>
              <MapView />
            </Layout>
          </MapProvider>
        </CollaborationProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;