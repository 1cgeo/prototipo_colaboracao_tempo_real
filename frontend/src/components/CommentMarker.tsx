// Path: components\CommentMarker.tsx
import React from 'react';
import { Marker, MarkerDragEvent } from 'react-map-gl/maplibre';
import { Comment } from '../types';
import { useCommentStore } from '../store/useCommentStore';
import { 
  Badge
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
  
  // Use the same color for all comment markers for consistency
  const markerColor = '#1976d2'; // Primary blue color
  
  return (
    <Marker
      longitude={comment.lng}
      latitude={comment.lat}
      draggable={isDraggable && isDraggingComment === comment.id}
      onDragEnd={handleDragEnd}
      anchor="bottom"
      color={markerColor}
    >
      <div
        onClick={handleMarkerClick}
        style={{ 
          cursor: 'pointer'
        }}
      >
        <Badge
          badgeContent={comment.replies.length}
          color="primary"
          invisible={comment.replies.length === 0}
          sx={{
            '& .MuiBadge-badge': { 
              fontSize: 10,
              pointerEvents: 'none'
            }
          }}
        >
          <CommentIcon 
            sx={{ 
              color: markerColor,
              fontSize: 32,
              filter: isDraggingComment === comment.id ? 
                'drop-shadow(0 0 5px rgba(0,0,0,0.5))' : 
                'none'
            }} 
          />
        </Badge>
      </div>
    </Marker>
  );
};

export default CommentMarker;