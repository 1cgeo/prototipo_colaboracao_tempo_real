import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button
} from '@mui/material';
import {
  Add as AddIcon
} from '@mui/icons-material';
import { Room, RoomCreateInput, RoomUpdateInput } from '../../types';
import { useCollaboration } from '../../contexts/CollaborationContext';
import RoomList from './RoomList';
import RoomCreate from './RoomCreate';
import RoomUpdate from './RoomUpdate';

const RoomManager: React.FC = () => {
  const { joinRoom } = useCollaboration();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

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

  // First load
  React.useEffect(() => {
    loadRooms();
  }, [loadRooms]);

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

  // Handle room join
  const handleJoinRoom = async (room: Room) => {
    try {
      await joinRoom(room.uuid);
    } catch (err) {
      setError(err as Error);
    }
  };

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
    </Paper>
  );
};

export default RoomManager;