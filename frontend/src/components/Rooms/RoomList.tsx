import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  CircularProgress,
  Box,
  Typography,
  ButtonBase
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
  rooms,
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
      <Typography color="error" sx={{ p: 2 }}>
        Error loading rooms: {error.message}
      </Typography>
    );
  }

  if (rooms.length === 0) {
    return (
      <Typography color="textSecondary" sx={{ p: 2 }}>
        No rooms available. Create one to get started!
      </Typography>
    );
  }

  return (
    <List>
      {rooms.map((room) => (
        <Box key={room.uuid}>
          <ButtonBase
            onClick={() => onJoinRoom(room)}
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
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          </ButtonBase>
        </Box>
      ))}
    </List>
  );
};

export default RoomList;