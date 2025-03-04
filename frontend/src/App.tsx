// Path: App.tsx
import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUserStore } from './store/useUserStore';
import { useCommentStore } from './store/useCommentStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMaps, createMap, updateMap, deleteMap } from './api/maps';
import { fetchMapComments } from './api/comments';
import { Comment, Reply, Map as MapType } from './types';
import MapContainer from './components/MapContainer';

// Material UI imports
import {
  Box,
  AppBar,
  Toolbar,
  Button,
  Container,
  Typography,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Snackbar,
  Alert
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { ZodError } from 'zod';
import { mapFormSchema } from './schemas/map.schema';

const SOCKET_SERVER = import.meta.env.VITE_SOCKET_SERVER;

function App() {
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [mapFormData, setMapFormData] = useState<{ name: string, description: string }>({ name: '', description: '' });
  const [editingMap, setEditingMap] = useState<number | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  
  const { currentMap, setUsers, updateUser, removeUser, setCurrentMap, clearUsers, setCurrentUser } = useUserStore();
  const { setComments, addComment, updateComment, moveComment, deleteComment, addReply, updateReply, deleteReply } = useCommentStore();
  
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  
  // Fetch maps with React Query
  const { data: maps = [], isLoading } = useQuery({
    queryKey: ['maps'],
    queryFn: fetchMaps
  });
  
  // Comments query
  const { data: commentsData } = useQuery({
    queryKey: ['comments', currentMap],
    queryFn: () => currentMap ? fetchMapComments(currentMap) : Promise.resolve([]),
    enabled: !!currentMap,
    staleTime: 1000 * 60, // 1 minute
  });
  
  // Mutations
  const createMapMutation = useMutation({
    mutationFn: createMap,
    onSuccess: (newMap) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      setMapFormData({ name: '', description: '' });
      setOpenDialog(false);
      joinMap(newMap.id);
    },
    onError: (error: Error) => {
      setErrorMessage(`Failed to create map: ${error.message}`);
    }
  });
  
  const updateMapMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: { name: string, description: string } }) => updateMap(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      setMapFormData({ name: '', description: '' });
      setOpenDialog(false);
      setEditingMap(null);
    },
    onError: (error: Error) => {
      setErrorMessage(`Failed to update map: ${error.message}`);
    }
  });
  
  const deleteMapMutation = useMutation({
    mutationFn: deleteMap,
    onSuccess: (_, deletedMapId) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      if (currentMap === deletedMapId) {
        setCurrentMap(null);
        clearUsers();
      }
    },
    onError: (error: Error) => {
      setErrorMessage(`Failed to delete map: ${error.message}`);
    }
  });

  // Set comments from query data
  useEffect(() => {
    if (commentsData) {
      console.log("Setting comments from query data:", commentsData.length);
      setComments(commentsData);
    }
  }, [commentsData, setComments]);
  
  // Socket initialization - RUN ONLY ONCE
  useEffect(() => {
    // Only initialize socket if it doesn't exist
    if (!socketRef.current) {
      try {
        // Log only once
        console.log("Connecting to socket server:", SOCKET_SERVER);
        
        socketRef.current = io(SOCKET_SERVER, {
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
          transports: ['websocket', 'polling'], // Try WebSocket first, then polling
          forceNew: false, // Don't force a new connection
          multiplex: true // Use multiplexing
        });
        
        // Clean up existing socket listeners to avoid duplicates
        socketRef.current.removeAllListeners();
        
        const socket = socketRef.current;
        
        // Log connection status for debugging
        socket.on('connect', () => {
          console.log("Socket connected with ID:", socket.id);
          setSocketConnected(true);
          
          // Rejoin map if we were on one before connection was lost
          if (currentMap) {
            console.log("Rejoining map after reconnection:", currentMap);
            socket.emit('join-map', currentMap);
          }
        });
        
        socket.on('disconnect', (reason) => {
          console.log("Socket disconnected:", reason);
          setSocketConnected(false);
        });
        
        // Add error handling for socket events
        socket.on('connect_error', (error) => {
          console.warn('Socket connection error:', error);
          setErrorMessage(`Connection issue: ${error.message}. Trying to reconnect...`);
        });
        
        socket.on('users', (usersData) => {
          console.log("Received users update:", usersData.length || 0);
          
          // Add proper type annotation for user
          const validUsers = usersData.filter((user: any) => user && user.id);
          setUsers(validUsers);
        });
        
        socket.on('user-move', (userData) => {
          // Don't log every move to avoid console spam
          updateUser(userData);
        });
        
        socket.on('user-disconnected', (userId) => {
          console.log("User disconnected:", userId);
          
          // Ensure the user is actually removed
          if (userId) {
            removeUser(userId);
            
            // Also check if we need to update the UI
            setTimeout(() => {
              const users = Object.keys(useUserStore.getState().users);
              console.log(`After disconnect: ${users.length} users remaining`);
            }, 500);
          }
        })
        
        socket.on('error', (error) => {
          console.error('Socket error:', error);
          // Only alert for critical errors, not common ones
          if (error && error !== 'null' && error !== 'undefined') {
            setErrorMessage(`Error: ${error}`);
          }
        });
        
        socket.on('user-info', (user) => {
          console.log("Received user info:", user?.name || user?.id);
          if (user && user.id) {
            // Ensure user has a position, even if just a default
            if (!user.position) {
              user.position = { lng: 0, lat: 0 };
            }
            setCurrentUser(user);
          }
        });
      } catch (err) {
        console.error("Socket connection error:", err);
        setErrorMessage("Failed to establish real-time connection. Please refresh the page.");
      }
    }
    
    // Clean up function with proper error handling
    return () => {
      try {
        if (socketRef.current && socketRef.current.connected) {
          // Log disconnection
          console.log("Cleaning up socket connection");
          // Remove all listeners to prevent duplicates
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
        }
      } catch (e) {
        console.error("Error disconnecting socket:", e);
      }
    };
  }, []); // Empty dependency array to run only once

  // Add a separate effect for current map changes
  useEffect(() => {
    // Only handle map changes if socket exists and is connected
    if (socketRef.current && currentMap) {
      console.log("Map changed, updating socket listeners");
      
      const socket = socketRef.current;
      
      // Remove existing listeners first to prevent duplicates
      socket.off('comment-created');
      socket.off('comment-updated');
      socket.off('comment-moved');
      socket.off('comment-deleted');
      socket.off('reply-created');
      socket.off('reply-updated');
      socket.off('reply-deleted');
      
      // Comment events
      socket.on('comment-created', (comment: Comment) => {
        console.log("Comment created:", comment.id);
        addComment(comment);
      });
      
      socket.on('comment-updated', (comment: Comment) => {
        console.log("Comment updated:", comment.id);
        updateComment(comment);
      });
      
      socket.on('comment-moved', (comment: Comment) => {
        console.log("Comment moved:", comment.id);
        moveComment(comment);
      });
      
      socket.on('comment-deleted', (commentId: number) => {
        console.log("Comment deleted:", commentId);
        deleteComment(commentId);
      });
      
      // Reply events
      socket.on('reply-created', ({ reply, commentId }: { reply: Reply, commentId: number }) => {
        console.log("Reply created for comment:", commentId);
        addReply(reply, commentId);
      });
      
      socket.on('reply-updated', ({ reply, commentId }: { reply: Reply, commentId: number }) => {
        console.log("Reply updated for comment:", commentId);
        updateReply(reply, commentId);
      });
      
      socket.on('reply-deleted', ({ replyId, commentId }: { replyId: number, commentId: number }) => {
        console.log("Reply deleted from comment:", commentId);
        deleteReply(replyId, commentId);
      });
      
      return () => {
        // Remove comment-related listeners when changing maps
        socket.off('comment-created');
        socket.off('comment-updated');
        socket.off('comment-moved');
        socket.off('comment-deleted');
        socket.off('reply-created');
        socket.off('reply-updated');
        socket.off('reply-deleted');
      };
    }
  }, [currentMap, addComment, updateComment, moveComment, deleteComment, addReply, updateReply, deleteReply]);

  // Join a specific map
  const joinMap = (mapId: number) => {
    clearUsers();
    setCurrentMap(mapId);
    
    if (socketRef.current) {
      console.log("Joining map:", mapId);
      
      // Make sure socket is connected before joining
      if (!socketRef.current.connected) {
        console.log("Socket not connected, connecting now...");
        socketRef.current.connect();
      }
      
      // Join map room
      socketRef.current.emit('join-map', mapId);
      
      // Force fetch comments
      queryClient.invalidateQueries({ queryKey: ['comments', mapId] });
    } else {
      setErrorMessage("Connection issue. Please refresh the page and try again.");
    }
  };

  // Open dialog for creating/editing a map
  const openMapDialog = (map?: MapType) => {
    if (map) {
      setMapFormData({ 
        name: map.name, 
        description: map.description || '' 
      });
      setEditingMap(map.id);
    } else {
      setMapFormData({ name: '', description: '' });
      setEditingMap(null);
    }
    setOpenDialog(true);
  };

  // Handle form submission with Zod validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    try {
      const validatedData = mapFormSchema.parse(mapFormData);
      
      if (editingMap) {
        updateMapMutation.mutate({ id: editingMap, data: validatedData });
      } else {
        createMapMutation.mutate(validatedData);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            errors[err.path[0]] = err.message;
          }
        });
        setFormErrors(errors);
      }
    }
  };

  // Handle delete map
  const handleDeleteMap = (mapId: number) => {
    if (window.confirm('Are you sure you want to delete this map?')) {
      deleteMapMutation.mutate(mapId);
    }
  };

  // Handle error alert close
  const handleCloseError = () => {
    setErrorMessage(null);
  };

  // Render MapContainer if map is selected
  if (currentMap) {
    const mapData = maps.find(m => m.id === currentMap);
    
    return (
      <>
        <MapContainer 
          mapId={currentMap}
          mapData={mapData}
          onBackClick={() => setCurrentMap(null)}
          socketRef={socketRef}
        />
        
        <Snackbar 
          open={!!errorMessage} 
          autoHideDuration={6000} 
          onClose={handleCloseError}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
            {errorMessage}
          </Alert>
        </Snackbar>
        
        {/* Connection indicator in development mode */}
        {process.env.NODE_ENV === 'development' && (
          <Box 
            sx={{ 
              position: 'fixed', 
              bottom: 10, 
              left: 10, 
              zIndex: 9999,
              bgcolor: socketConnected ? 'success.main' : 'error.main',
              color: 'white',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: 12,
              opacity: 0.7
            }}
          >
            {socketConnected ? 'Socket Connected' : 'Socket Disconnected'}
          </Box>
        )}
      </>
    );
  }

  // Render map selection
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Map Selection
          </Typography>
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<AddIcon />}
            onClick={() => openMapDialog()}
          >
            Create New Map
          </Button>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : maps.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="subtitle1">
              No maps available. Create one to get started!
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {maps.map(map => (
              <Grid item xs={12} sm={6} md={4} key={map.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h5" component="div">
                      {map.name}
                    </Typography>
                    {map.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {map.description}
                      </Typography>
                    )}
                  </CardContent>
                  <Divider />
                  <CardActions>
                    <Button 
                      size="small" 
                      color="primary" 
                      onClick={() => joinMap(map.id)}
                    >
                      Join
                    </Button>
                    <Button 
                      size="small" 
                      startIcon={<EditIcon />}
                      onClick={() => openMapDialog(map)}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="small" 
                      color="error" 
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDeleteMap(map.id)}
                      disabled={deleteMapMutation.isPending}
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
      
      {/* Map Dialog Form */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingMap ? 'Edit Map' : 'Create New Map'}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Name"
              type="text"
              fullWidth
              variant="outlined"
              value={mapFormData.name}
              onChange={(e) => setMapFormData({...mapFormData, name: e.target.value})}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
              sx={{ mb: 2, mt: 1 }}
            />
            <TextField
              margin="dense"
              label="Description"
              type="text"
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              value={mapFormData.description}
              onChange={(e) => setMapFormData({...mapFormData, description: e.target.value})}
              error={!!formErrors.description}
              helperText={formErrors.description}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={createMapMutation.isPending || updateMapMutation.isPending}
            >
              {createMapMutation.isPending || updateMapMutation.isPending ? 
                <CircularProgress size={24} color="inherit" /> : 
                editingMap ? 'Update' : 'Create'
              }
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      
      {/* Connection indicator in development mode */}
      {process.env.NODE_ENV === 'development' && (
        <Box 
          sx={{ 
            position: 'fixed', 
            bottom: 10, 
            left: 10, 
            zIndex: 9999,
            bgcolor: socketConnected ? 'success.main' : 'error.main',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: 12,
            opacity: 0.7
          }}
        >
          {socketConnected ? 'Socket Connected' : 'Socket Disconnected'}
        </Box>
      )}
      
      <Snackbar 
        open={!!errorMessage} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;