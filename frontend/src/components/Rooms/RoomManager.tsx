import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon
} from '@mui/icons-material';
import { Room, RoomCreateInput, RoomUpdateInput } from '../../types';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { roomApi } from '../../utils/api';
import RoomList from './RoomList';
import RoomCreate from './RoomCreate';
import RoomUpdate from './RoomUpdate';

const RoomManager: React.FC = () => {
  const { joinRoom } = useCollaboration();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showError, setShowError] = useState(false);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Load rooms
  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const loadedRooms = await roomApi.list();
      setRooms(loadedRooms);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load rooms');
      setError(error);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // First load
  React.useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Handle room creation
  const handleCreateRoom = async (input: RoomCreateInput) => {
    setLoading(true);
    try {
      const newRoom = await roomApi.create(input);
      setRooms(prev => [...prev, newRoom]);
      setCreateDialogOpen(false);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create room');
      setError(error);
      setShowError(true);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Handle room update
  const handleUpdateRoom = async (roomId: string, input: RoomUpdateInput) => {
    setLoading(true);
    try {
      const updatedRoom = await roomApi.update(roomId, input);
      setRooms(prev => prev.map(room => 
        room.uuid === updatedRoom.uuid ? updatedRoom : room
      ));
      setUpdateDialogOpen(false);
      setSelectedRoom(null);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update room');
      setError(error);
      setShowError(true);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Handle room deletion
  const handleDeleteRoom = async (roomId: string) => {
    setLoading(true);
    try {
      await roomApi.delete(roomId);
      setRooms(prev => prev.filter(room => room.uuid !== roomId));
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete room');
      setError(error);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle room join
  const handleJoinRoom = async (room: Room) => {
    try {
      await joinRoom(room.uuid);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to join room');
      setError(error);
      setShowError(true);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Mapas disponíveis
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={loading}
        >
          Criar Mapa
        </Button>
      </Box>

      <RoomList
        rooms={rooms}
        loading={loading}
        error={error}
        onJoinRoom={handleJoinRoom}
        onEditRoom={(room) => {
          setSelectedRoom(room);
          setUpdateDialogOpen(true);
        }}
        onDeleteRoom={(room) => handleDeleteRoom(room.uuid)}
      />

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

      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={() => setShowError(false)}
      >
        <Alert severity="error" onClose={() => setShowError(false)}>
          {error?.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default RoomManager;