import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress
} from '@mui/material';
import { RoomCreateInput } from '../../types';

interface RoomCreateProps {
  open: boolean;
  loading: boolean;
  error: Error | null;
  onClose: () => void;
  onSubmit: (input: RoomCreateInput) => Promise<void>;
}

const RoomCreate: React.FC<RoomCreateProps> = ({
  open,
  loading,
  error,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<RoomCreateInput>({
    name: '',
    description: ''
  });

  const handleSubmit = async () => {
    await onSubmit(formData);
    setFormData({ name: '', description: '' });
  };

  const handleClose = () => {
    setFormData({ name: '', description: '' });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Create New Room</DialogTitle>
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
          disabled={loading || !formData.name.trim()}
        >
          {loading ? <CircularProgress size={24} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoomCreate;