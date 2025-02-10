import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  ButtonBase
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { Room, RoomCreateInput, RoomUpdateInput } from '../../types';
import { useCollaboration } from '../../contexts/CollaborationContext';
import RoomCreate from './RoomCreate';
import RoomUpdate from './RoomUpdate';

const RoomManager: React.FC = () => {
  const { currentRoom, joinRoom } = useCollaboration();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Handle room creation
  const handleCreateRoom = async (input: RoomCreateInput) => {
    setLoading(true);
    try {
      const response = await fetch('/api/maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const newRoom = await response.json();
      setRooms(prev => [...prev, newRoom]);
      setCreateDialogOpen(false);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handle room update
  const handleUpdateRoom = async (roomId: string, input: RoomUpdateInput) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/maps/${roomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const updatedRoom = await response.json();
      setRooms(prev => prev.map(room => 
        room.uuid === updatedRoom.uuid ? updatedRoom : room
      ));
      setUpdateDialogOpen(false);
      setSelectedRoom(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handle room deletion
  const handleDeleteRoom = async (roomId: string) => {
    setLoading(true);
    try {
      await fetch(`/api/maps/${roomId}`, {
        method: 'DELETE',
      });
      setRooms(prev => prev.filter(room => room.uuid !== roomId));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Load rooms
  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/maps');
      const rooms = await response.json();
      setRooms(rooms);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle room join
  const handleJoinRoom = async (room: Room) => {
    try {
      await joinRoom(room.uuid);
    } catch (err) {
      setError(err as Error);
    }
  };

  if (loading && !rooms.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Available Rooms
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Room
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          Error: {error.message}
        </Typography>
      )}

      <List>
        {rooms.map((room) => (
          <Box key={room.uuid}>
            <ButtonBase
              onClick={() => handleJoinRoom(room)}
              sx={{ width: '100%', textAlign: 'left' }}
            >
              <ListItem
                sx={{
                  mb: 1,
                  width: '100%',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <ListItemText
                  primary={room.name}
                  secondary={room.description}
                />
                <ListItemSecondaryAction>
                  <Chip
                    icon={<PeopleIcon />}
                    label={`${room.activeUsers} online`}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <IconButton
                    edge="end"
                    aria-label="edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRoom(room);
                      setUpdateDialogOpen(true);
                    }}
                    sx={{ mr: 1 }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRoom(room.uuid);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            </ButtonBase>
          </Box>
        ))}
      </List>

      <RoomCreate
        open={createDialogOpen}
        loading={loading}
        error={error}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreateRoom}
      />

      {selectedRoom && (
        <RoomUpdate
          open={updateDialogOpen}
          loading={loading}
          error={error}
          room={selectedRoom}
          onClose={() => {
            setUpdateDialogOpen(false);
            setSelectedRoom(null);
          }}
          onSubmit={(input) => handleUpdateRoom(selectedRoom.uuid, input)}
        />
      )}
    </Paper>
  );
};

export default RoomManager;