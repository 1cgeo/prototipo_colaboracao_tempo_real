import React from 'react';
import {
  List,
  ListItem,
  Alert,
  IconButton,
  Chip,
  CircularProgress,
  Box,
  Typography,
  Paper,
  ListItemButton,
  ListItemText
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { Room } from '../../types';

interface RoomListProps {
  rooms: Room[];
  loading: boolean;
  error: Error | null;
  onJoinRoom: (room: Room) => void;
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
}

const RoomList: React.FC<RoomListProps> = ({
  rooms = [], // Default to empty array to prevent map error
  loading,
  error,
  onJoinRoom,
  onEditRoom,
  onDeleteRoom
}) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error.message}
      </Alert>
    );
  }

  if (!Array.isArray(rooms) || rooms.length === 0) {
    return (
      <Typography color="textSecondary" sx={{ p: 2 }}>
        No rooms available. Create one to get started!
      </Typography>
    );
  }

  return (
    <List>
      {rooms.map((room) => (
        <Paper 
          key={room.uuid} 
          variant="outlined" 
          sx={{ mb: 1, overflow: 'hidden' }}
        >
          <ListItem 
            disablePadding
            secondaryAction={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  icon={<PeopleIcon />}
                  label={`${room.active_users_count} online`}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <IconButton
                  edge="end"
                  aria-label="edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditRoom(room);
                  }}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRoom(room);
                  }}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            }
          >
            <ListItemButton onClick={() => onJoinRoom(room)}>
              <ListItemText
                primary={room.name}
                secondary={room.description}
                primaryTypographyProps={{
                  variant: 'subtitle1',
                  component: 'div',
                  noWrap: true
                }}
                secondaryTypographyProps={{
                  variant: 'body2',
                  color: 'textSecondary',
                  noWrap: true
                }}
              />
            </ListItemButton>
          </ListItem>
        </Paper>
      ))}
    </List>
  );
};

export default RoomList;