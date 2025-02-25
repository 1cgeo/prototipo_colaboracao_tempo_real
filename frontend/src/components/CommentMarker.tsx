// src/components/CommentMarker.tsx
import React from 'react';
import { Marker, MarkerDragEvent } from 'react-map-gl';
import { Comment } from '../types';
import { useCommentStore } from '../store/useCommentStore';
import { 
  Box, 
  Badge, 
  useTheme, 
  Tooltip 
} from '@mui/material';
import { Comment as CommentIcon } from '@mui/icons-material';

interface CommentMarkerProps {
  comment: Comment;
  isDraggable: boolean;
  onDragEnd?: (lng: number, lat: number) => void;
}

const CommentMarker: React.FC<CommentMarkerProps> = ({ 
  comment, 
  isDraggable, 
  onDragEnd 
}) => {
  const theme = useTheme();
  const { selectComment, isDraggingComment } = useCommentStore();
  
  const handleMarkerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectComment(comment);
  };
  
  const handleDragEnd = (event: MarkerDragEvent) => {
    if (onDragEnd) {
      onDragEnd(event.lngLat.lng, event.lngLat.lat);
    }
  };
  
  return (
    <Marker
      longitude={comment.lng}
      latitude={comment.lat}
      draggable={isDraggable && isDraggingComment === comment.id}
      onDragEnd={handleDragEnd}
    >
      <Tooltip title={comment.content.length > 30 ? 
        `${comment.content.substring(0, 30)}...` : comment.content
      }>
        <Box 
          onClick={handleMarkerClick}
          sx={{ 
            cursor: 'pointer',
            transform: 'translate(-50%, -100%)'
          }}
        >
          <Badge
            badgeContent={comment.replies.length}
            color="primary"
            invisible={comment.replies.length === 0}
            sx={{ '.MuiBadge-badge': { fontSize: 10 } }}
          >
            <CommentIcon 
              sx={{ 
                color: theme.palette.primary.main,
                fontSize: 36,
                filter: isDraggingComment === comment.id ? 
                  'drop-shadow(0 0 5px rgba(0,0,0,0.5))' : 
                  'none'
              }} 
            />
          </Badge>
        </Box>
      </Tooltip>
    </Marker>
  );
};

export default CommentMarker;