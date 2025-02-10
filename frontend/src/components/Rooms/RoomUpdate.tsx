import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress
} from '@mui/material';
import { Room, RoomUpdateInput } from '../../types';

interface RoomUpdateProps {
  open: boolean;
  loading: boolean;
  error: Error | null;
  room: Room | null;
  onClose: () => void;
  onSubmit: (input: RoomUpdateInput) => Promise<void>;
}

const RoomUpdate: React.FC<RoomUpdateProps> = ({
  open,
  loading,
  error,
  room,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<RoomUpdateInput>({
    name: '',
    description: ''
  });

  // Update form data when room changes
  useEffect(() => {
    if (room) {
      setFormData({
        name: room.name,
        description: room.description
      });
    }
  }, [room]);

  const handleSubmit = async () => {
    await onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({ name: '', description: '' });
    onClose();
  };

  if (!room) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Update Room</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Room Name"
          type="text"
          fullWidth
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          disabled={loading}
          error={Boolean(error)}
          helperText={error?.message}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label="Description"
          type="text"
          fullWidth
          multiline
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.name?.trim()}
        >
          {loading ? <CircularProgress size={24} /> : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoomUpdate;