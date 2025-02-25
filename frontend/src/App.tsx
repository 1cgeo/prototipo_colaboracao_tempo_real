// src/App.tsx
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
  Paper
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
    }
  });
  
  const updateMapMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: { name: string, description: string } }) => updateMap(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      setMapFormData({ name: '', description: '' });
      setOpenDialog(false);
      setEditingMap(null);
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
    }
  });

  // Set comments from query data
  useEffect(() => {
    if (commentsData) {
      setComments(commentsData);
    }
  }, [commentsData, setComments]);
  
  // Socket initialization
  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_SERVER);
    
    const socket = socketRef.current;
    
    socket.on('users', (usersData) => {
      setUsers(usersData);
    });
    
    socket.on('user-move', (userData) => {
      updateUser(userData);
    });
    
    socket.on('user-disconnected', (userId) => {
      removeUser(userId);
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      alert(`Error: ${error}`);
    });
    
    socket.on('user-info', (user) => {
      setCurrentUser(user);
    });
    
    return () => {
      socket.disconnect();
    };
  }, [setUsers, updateUser, removeUser, setCurrentUser]); // Added missing dependencies
  
  // Socket effect for comments and replies
  useEffect(() => {
    if (!socketRef.current || !currentMap) return;
    
    const socket = socketRef.current;
    
    // Comment events
    socket.on('comment-created', (comment: Comment) => {
      addComment(comment);
    });
    
    socket.on('comment-updated', (comment: Comment) => {
      updateComment(comment);
    });
    
    socket.on('comment-moved', (comment: Comment) => {
      moveComment(comment);
    });
    
    socket.on('comment-deleted', (commentId: number) => {
      deleteComment(commentId);
    });
    
    // Reply events
    socket.on('reply-created', ({ reply, commentId }: { reply: Reply, commentId: number }) => {
      addReply(reply, commentId);
    });
    
    socket.on('reply-updated', ({ reply, commentId }: { reply: Reply, commentId: number }) => {
      updateReply(reply, commentId);
    });
    
    socket.on('reply-deleted', ({ replyId, commentId }: { replyId: number, commentId: number }) => {
      deleteReply(replyId, commentId);
    });
    
    return () => {
      socket.off('comment-created');
      socket.off('comment-updated');
      socket.off('comment-moved');
      socket.off('comment-deleted');
      socket.off('reply-created');
      socket.off('reply-updated');
      socket.off('reply-deleted');
    };
  }, [currentMap, addComment, updateComment, moveComment, deleteComment, addReply, updateReply, deleteReply]);

  // Join a specific map
  const joinMap = (mapId: number) => {
    clearUsers();
    setCurrentMap(mapId);
    socketRef.current?.emit('join-map', mapId);
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

  // Render MapContainer if map is selected
  if (currentMap) {
    const mapData = maps.find(m => m.id === currentMap);
    
    return (
      <MapContainer 
        mapId={currentMap}
        mapData={mapData}
        onBackClick={() => setCurrentMap(null)}
        socketRef={socketRef}
      />
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
    </Box>
  );
}

export default App;