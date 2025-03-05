// Path: components\MapContainer.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Map, MapRef, ViewStateChangeEvent, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { 
  Box, 
  IconButton, 
  Typography, 
  Button, 
  AppBar, 
  Toolbar, 
  ToggleButton, 
  Tooltip, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Divider,
  Drawer,
  ListItemButton,
  ListItemIcon,
  Collapse
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon, 
  PersonPin as PersonPinIcon, 
  Add as AddIcon, 
  Close as CloseIcon,
  Visibility,
  VisibilityOff,
  Menu as MenuIcon,
  ZoomIn as ZoomInIcon,
  Comment as CommentIcon,
  ExpandMore,
  ExpandLess,
  Explore as ExploreIcon
} from '@mui/icons-material';
import { throttle } from 'lodash';
import { useUserStore } from '../store/useUserStore';
import { useCommentStore } from '../store/useCommentStore';
import { useMutation } from '@tanstack/react-query';
import { updateCommentPosition } from '../api/comments';
import { Position, Map as MapType } from '../types';
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
  socketRef: React.MutableRefObject<Socket | null>;
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
  // Don't use viewState directly in the Map component - causes infinite loop
  const [currentViewState, setCurrentViewState] = useState(INITIAL_VIEW_STATE);
  const [addCommentPosition, setAddCommentPosition] = useState<Position | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mousePosition, setMousePosition] = useState<Position | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(true);
  const [usersExpanded, setUsersExpanded] = useState(true);
  
  const { 
    users, 
    currentUser,
    disableCursorTracking,
    toggleCursorTracking,
    removeUser
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
  
  // Store previous users for cleanup check
  const prevUsersRef = useRef<string[]>([]);
  
  // Memoize socket ID for stable comparisons
  const socketId = useMemo(() => socketRef.current?.id, [socketRef.current?.id]);
  
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
  
  // Effect to ensure socket connection is established for the map
  useEffect(() => {
    if (mapRef && socketRef.current && mapId && !mapInitialized) {
      // Ensure we're connected to the map room
      socketRef.current.emit('join-map', mapId);
      setMapInitialized(true);
      
      // Setup disconnect handler
      socketRef.current.on('user-disconnected', (userId) => {
        console.log("User disconnected event received:", userId);
        removeUser(userId);
      });
      
      // Log only once
      console.log("Map initialized, socket joined map:", mapId);
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('user-disconnected');
        }
      };
    }
  }, [mapRef, socketRef, mapId, mapInitialized, removeUser]);
  
  // Check for stale users
  useEffect(() => {
    const currentUserIds = Object.keys(users);
    const currentSet = new Set(currentUserIds);
    
    // Check for users that were in prev but not in current
    prevUsersRef.current.forEach(userId => {
      if (!currentSet.has(userId)) {
        console.log("User disappeared without disconnect event:", userId);
      }
    });
    
    // Update ref for next check
    prevUsersRef.current = currentUserIds;
    
  }, [users]);
  
  // Debug effect to log users and comments - reduced frequency
  useEffect(() => {
    const userIds = Object.keys(users);
    console.log(`Current users (${userIds.length}):`, userIds.length > 0 ? users : "No users");
    console.log(`Current comments (${comments.length}):`, comments.length > 0 ? `${comments.length} comments` : "No comments");
  }, [Object.keys(users).length, comments.length]); // Only log when counts change
  
  // Handle map click for adding comment
  const handleMapClick = (e: MapLayerMouseEvent) => {
    // Stop event propagation to prevent unwanted behaviors
    e.originalEvent.stopPropagation();
    
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
  
  // Handle view state change - track it but don't directly feed it back to the map
  const handleViewStateChange = useCallback((e: ViewStateChangeEvent) => {
    // Store the current view state for UI display without feeding it back to the map
    setCurrentViewState(e.viewState);
  }, []);
  
  // Fly to comment location
  const flyToComment = (comment: { lng: number, lat: number }) => {
    if (!mapRef) return;
    
    mapRef.flyTo({
      center: [comment.lng, comment.lat],
      zoom: Math.max(currentViewState.zoom, 15), // Ensure we're zoomed in enough
      duration: 1000
    });
    
    // Close drawer on mobile
    if (window.innerWidth < 600) {
      setDrawerOpen(false);
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
  
  // Throttle mouse movement with increased delay and only emit when necessary
  const handleMouseMove = useCallback(throttle((e: MapLayerMouseEvent) => {
    // Skip sending position updates when dragging, in special modes, or tracking disabled
    if (isDraggingComment !== false || isAddingComment || disableCursorTracking) return;
    
    if (!mapRef || !socketRef.current) return;
    
    // Get coordinates directly from the event's lngLat
    const lngLat = {
      lng: e.lngLat.lng,
      lat: e.lngLat.lat
    };
    
    // Update local mouse position state
    setMousePosition(lngLat);
    
    // Send raw coordinates to server with increased throttle time
    socketRef.current.emit('mousemove', lngLat);
  }, 150), [mapRef, socketRef, isDraggingComment, isAddingComment, disableCursorTracking]);
  
  const userCount = Object.keys(users).length;
  
  // Safely render markers with defensive checks - don't show your own cursor
  const renderUserMarkers = () => {
    return Object.values(users)
      .filter(user => {
        // Skip rendering yourself
        if (user.id === socketId) {
          return false;
        }
        
        // Skip rendering if user or position is undefined
        if (!user || !user.position || typeof user.position.lng === 'undefined' || typeof user.position.lat === 'undefined') {
          console.warn("Invalid user data:", user);
          return false;
        }
        
        return true;
      })
      .map(user => (
        <UserMarker
          key={`user-${user.id}`}
          user={user}
          isSelf={false} // Always false since we filter out self
          socketId={socketId}
        />
      ));
  };
  
  const renderCommentMarkers = () => {
    if (!comments || comments.length === 0) {
      return null;
    }
    
    return comments
      .filter(comment => {
        // Skip rendering if comment has invalid coordinates
        if (typeof comment.lng === 'undefined' || typeof comment.lat === 'undefined') {
          console.warn("Invalid comment data:", comment);
          return false;
        }
        // Filter out the dragging comment to avoid duplicates
        return typeof isDraggingComment !== 'number' || isDraggingComment !== comment.id;
      })
      .map(comment => (
        <CommentMarker
          key={`comment-${comment.id}`}
          comment={comment}
          isDraggable={comment.user_id === currentUser?.id}
          onDragEnd={(lng, lat) => handleCommentDragEnd(comment.id, lng, lat)}
        />
      ));
  };
  
  const renderDraggingComment = () => {
    if (typeof isDraggingComment !== 'number') return null;
    
    const comment = comments.find(c => c.id === isDraggingComment);
    if (!comment || typeof comment.lng === 'undefined' || typeof comment.lat === 'undefined') return null;
    
    return (
      <CommentMarker
        key={`dragging-comment-${comment.id}`}
        comment={comment}
        isDraggable={true}
        onDragEnd={(lng, lat) => handleCommentDragEnd(comment.id, lng, lat)}
      />
    );
  };
  
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  const drawerWidth = 280;
  
  return (
    <Box 
      sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden', // Prevent overflow scrolling
        position: 'fixed', // Fix the container to viewport
        width: '100%',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onBackClick}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          
          <IconButton 
            color="inherit" 
            edge="start" 
            onClick={toggleDrawer}
            sx={{ mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {mapData?.name || 'Map'} 
            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                (Users: {userCount}, Comments: {comments.length})
              </Typography>
            )}
          </Typography>
          
          {/* Show current user name */}
          {currentUser && (
            <Typography variant="body2" sx={{ mr: 2 }}>
              You: {currentUser.name}
            </Typography>
          )}
          
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
                {userCount - (socketId && users[socketId] ? 1 : 0)} user{userCount !== 2 ? 's' : ''} online
              </Typography>
            </Box>
            
            {/* Fixed cursor tracking toggle button - make it more visible */}
            <Tooltip title={disableCursorTracking ? "Enable cursor tracking" : "Disable cursor tracking"}>
              <ToggleButton
                value="cursorTracking"
                selected={!disableCursorTracking}
                onChange={() => toggleCursorTracking(!disableCursorTracking)}
                size="small"
                color="primary"
                sx={{ 
                  ml: 1, 
                  p: 1,
                  border: '1px solid white',
                  bgcolor: disableCursorTracking ? 'transparent' : 'primary.dark',
                  color: 'white',
                  '&.Mui-selected': {
                    bgcolor: 'primary.dark',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    }
                  }
                }}
              >
                {disableCursorTracking ? <VisibilityOff /> : <Visibility />}
              </ToggleButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Side drawer for comments and users */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <AppBar position="static" color="default" elevation={0}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Map Details
            </Typography>
            <IconButton onClick={toggleDrawer}>
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        
        <List sx={{ p: 0 }}>
          {/* Comments section */}
          <ListItemButton onClick={() => setCommentsExpanded(!commentsExpanded)}>
            <ListItemIcon>
              <CommentIcon />
            </ListItemIcon>
            <ListItemText primary={`Comments (${comments.length})`} />
            {commentsExpanded ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          
          <Collapse in={commentsExpanded} timeout="auto">
            <List component="div" disablePadding>
              {comments.length === 0 ? (
                <ListItem sx={{ pl: 4 }}>
                  <ListItemText secondary="No comments yet" />
                </ListItem>
              ) : (
                comments.map(comment => (
                  <ListItemButton 
                    key={comment.id} 
                    sx={{ pl: 4 }}
                    onClick={() => {
                      flyToComment(comment);
                      selectComment(comment);
                    }}
                  >
                    <ListItemIcon>
                      <ZoomInIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={comment.user_name}
                      secondary={
                        <>
                          {comment.content.length > 30 
                            ? `${comment.content.substring(0, 30)}...` 
                            : comment.content
                          }
                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                            Replies: {comment.replies.length}
                          </Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                ))
              )}
            </List>
          </Collapse>
          
          <Divider />
          
          {/* Users section */}
          <ListItemButton onClick={() => setUsersExpanded(!usersExpanded)}>
            <ListItemIcon>
              <PersonPinIcon />
            </ListItemIcon>
            <ListItemText primary={`Users (${userCount})`} />
            {usersExpanded ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          
          <Collapse in={usersExpanded} timeout="auto">
            <List component="div" disablePadding>
              {/* Show yourself first with a special indicator */}
              {currentUser && (
                <ListItem sx={{ pl: 4, bgcolor: 'rgba(25, 118, 210, 0.08)' }}>
                  <ListItemText 
                    primary={`${currentUser.name} (You)`}
                    primaryTypographyProps={{
                      color: 'primary',
                      fontWeight: 'bold'
                    }}
                  />
                </ListItem>
              )}
              
              {/* Then show other users */}
              {Object.values(users)
                .filter(user => user.id !== socketId)
                .map(user => (
                  <ListItem key={user.id} sx={{ pl: 4 }}>
                    <ListItemText 
                      primary={user.name}
                      secondary={
                        user.position ? 
                          `${user.position.lng.toFixed(6)}, ${user.position.lat.toFixed(6)}` : 
                          'No position'
                      }
                    />
                  </ListItem>
                ))
              }
              
              {/* If no other users, show message */}
              {Object.values(users).filter(user => user.id !== socketId).length === 0 && (
                <ListItem sx={{ pl: 4 }}>
                  <ListItemText secondary="No other users online" />
                </ListItem>
              )}
            </List>
          </Collapse>
        </List>
      </Drawer>
      
      <Box 
        sx={{ 
          flexGrow: 1, 
          position: 'relative',
          overflow: 'hidden', // Ensure no overflow within the map container
          ml: drawerOpen ? `${drawerWidth}px` : 0,
          transition: theme => theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Map
          ref={setMapRef}
          initialViewState={INITIAL_VIEW_STATE}
          onMove={handleViewStateChange}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://demotiles.maplibre.org/style.json"
          onMouseMove={handleMouseMove}
          onClick={handleMapClick}
          cursor={isAddingComment ? 'crosshair' : 'grab'}
        >
          {/* Render markers with defensive checks */}
          {renderUserMarkers()}
          {renderCommentMarkers()}
          {renderDraggingComment()}
        </Map>
        
        {/* Coordinates display */}
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16, 
            p: 1,
            zIndex: 1,
            minWidth: 200,
            opacity: 0.9
          }}
        >
          <Typography variant="caption" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
            <ExploreIcon fontSize="small" sx={{ mr: 0.5 }} />
            Current View:
          </Typography>
          <Typography variant="body2">
            Center: {currentViewState.longitude.toFixed(6)}, {currentViewState.latitude.toFixed(6)}
          </Typography>
          <Typography variant="body2">
            Zoom: {currentViewState.zoom.toFixed(2)}
          </Typography>
          
          {mousePosition && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                Mouse Position:
              </Typography>
              <Typography variant="body2" color="primary">
                {mousePosition.lng.toFixed(6)}, {mousePosition.lat.toFixed(6)}
              </Typography>
            </>
          )}
        </Paper>
        
        {/* Debug overlay for development */}
        {process.env.NODE_ENV === 'development' && userCount === 0 && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 10, 
              right: 10, 
              bgcolor: 'rgba(255,255,255,0.8)', 
              p: 1,
              borderRadius: 1
            }}
          >
            <Typography variant="caption" color="error">
              No users detected. Socket.IO connection may have issues.
            </Typography>
          </Box>
        )}
        
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