// src/components/MapContainer.tsx
import React, { useState } from 'react';
import { Map, MapRef, MapLayerMouseEvent } from 'react-map-gl';
import { Box, IconButton, Typography, Button, AppBar, Toolbar } from '@mui/material';
import { ArrowBack as ArrowBackIcon, PersonPin as PersonPinIcon, Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { throttle } from 'lodash';
import { useUserStore } from '../store/useUserStore';
import { useCommentStore } from '../store/useCommentStore';
import { useMutation } from '@tanstack/react-query';
import { updateCommentPosition } from '../api/comments';
import { Position, Map as MapType, Comment } from '../types';
import UserMarker from './UserMarker';
import CommentMarker from './CommentMarker';
import CommentDialog from './CommentDialog';
import AddCommentLayer from './AddCommentLayer';

// Import Socket type
import { Socket } from 'socket.io-client';

interface MapContainerProps {
  mapId: number;
  mapData: MapType | undefined;
  onBackClick: () => void;
  socketRef: React.MutableRefObject<Socket | null>; // Updated to allow null
}

const INITIAL_VIEW_STATE = {
  longitude: -74.006,
  latitude: 40.7128,
  zoom: 12
};

const MapContainer: React.FC<MapContainerProps> = ({ 
  mapId, 
  mapData, 
  onBackClick,
  socketRef
}) => {
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [addCommentPosition, setAddCommentPosition] = useState<Position | null>(null);
  
  const { 
    users, 
    currentUser 
  } = useUserStore();
  
  const { 
    comments, 
    selectedComment, 
    isAddingComment, 
    isDraggingComment,
    selectComment, 
    setIsAddingComment,
    setIsDraggingComment
  } = useCommentStore();
  
  // Comment position mutation
  const updateCommentPositionMutation = useMutation({
    mutationFn: ({ commentId, position }: { commentId: number, position: Position }) => {
      return updateCommentPosition(
        commentId, 
        currentUser?.id || '', 
        position
      );
    }
  });
  
  // Handle map click for adding comment
  const handleMapClick = (e: MapLayerMouseEvent) => {
    // Skip if we're dragging a comment
    if (isDraggingComment !== false) {
      // If we were moving a comment, finish the move
      if (typeof isDraggingComment === 'number') {
        setIsDraggingComment(false);
      }
      return;
    }
    
    // Add comment at clicked position
    if (isAddingComment) {
      setAddCommentPosition({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat
      });
    } else {
      // If a comment is selected, deselect it
      if (selectedComment) {
        selectComment(null);
      }
    }
  };
  
  // Handle comment drag end
  const handleCommentDragEnd = (commentId: number, lng: number, lat: number) => {
    updateCommentPositionMutation.mutate({
      commentId,
      position: { lng, lat }
    });
    setIsDraggingComment(false);
  };
  
  // Throttle mouse movement
  const handleMouseMove = throttle((e: MapLayerMouseEvent) => {
    if (!mapRef || !socketRef.current) return;
    
    const map = mapRef;
    const point: [number, number] = [e.point.x, e.point.y];
    const lngLat = map.unproject(point);
    
    socketRef.current.emit('mousemove', {
      lng: lngLat.lng,
      lat: lngLat.lat
    } as Position);
  }, 50);
  
  const userCount = Object.keys(users).length;
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onBackClick}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {mapData?.name || 'Map'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button 
              variant="contained" 
              color="secondary" 
              startIcon={isAddingComment ? <CloseIcon /> : <AddIcon />}
              onClick={() => setIsAddingComment(!isAddingComment)}
              size="small"
            >
              {isAddingComment ? 'Cancel' : 'Add Comment'}
            </Button>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <PersonPinIcon sx={{ mr: 1 }} />
              <Typography variant="body2">
                {userCount} user{userCount !== 1 ? 's' : ''} online
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <Map
          ref={setMapRef}
          initialViewState={INITIAL_VIEW_STATE}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://demotiles.maplibre.org/style.json"
          onMouseMove={handleMouseMove}
          onClick={handleMapClick}
          cursor={isAddingComment ? 'crosshair' : 'grab'}
        >
          {/* Render user markers */}
          {Object.values(users).map(user => (
            <UserMarker
              key={user.id}
              user={user}
              isSelf={user.id === socketRef.current?.id}
              socketId={socketRef.current?.id}
            />
          ))}
          
          {/* Render comment markers */}
          {comments.map((comment: Comment) => (
            <CommentMarker
              key={comment.id}
              comment={comment}
              isDraggable={comment.user_id === currentUser?.id}
              onDragEnd={(lng, lat) => handleCommentDragEnd(comment.id, lng, lat)}
            />
          ))}
        </Map>
        
        {/* Comment-related dialogs */}
        {selectedComment && (
          <CommentDialog 
            comment={selectedComment} 
            onClose={() => selectComment(null)} 
          />
        )}
        
        {isAddingComment && addCommentPosition && (
          <AddCommentLayer 
            mapId={mapId}
            position={addCommentPosition}
            onClose={() => {
              setAddCommentPosition(null);
              setIsAddingComment(false);
            }}
          />
        )}
      </Box>
    </Box>
  );
};

export default MapContainer;