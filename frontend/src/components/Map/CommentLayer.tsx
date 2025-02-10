import React, { useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Box } from '@mui/material';
import { useMap } from '../../contexts/MapContext';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { Comment, Point, CommentCreateInput } from '../../types';
import { 
  CommentCreate, 
  CommentDetail, 
  CommentList 
} from '../Comments';
import { useComments } from '../../hooks';

interface CommentMarker {
  marker: maplibregl.Marker;
  popup: maplibregl.Popup;
}

interface CreateDialogState {
  open: boolean;
  location: Point | null;
}

const CommentLayer: React.FC = () => {
  const { map } = useMap();
  const { currentRoom } = useCollaboration();
  const { 
    comments, 
    loading, 
    error,
    createComment, 
    updateComment,
    deleteComment,
    selectedComment,
    selectComment 
  } = useComments({
    roomId: currentRoom?.uuid || null
  });

  // State for markers and dialogs
  const [markers, setMarkers] = useState<Map<string, CommentMarker>>(new Map());
  const [createDialog, setCreateDialog] = useState<CreateDialogState>({
    open: false,
    location: null
  });

  // Clear existing markers and popups
  const clearMarkers = useCallback(() => {
    markers.forEach(({ marker, popup }) => {
      marker.remove();
      popup.remove();
    });
    setMarkers(new Map());
  }, [markers]);

  // Create comment marker
  const createCommentMarker = useCallback((comment: Comment) => {
    if (!map) return null;

    // Create marker element
    const el = document.createElement('div');
    el.className = 'comment-marker';
    el.style.cssText = `
      width: 30px;
      height: 30px;
      background: #1976d2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/></svg>';

    // Create popup
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      offset: [0, -15]
    });

    // Create marker
    const marker = new maplibregl.Marker({
      element: el,
      anchor: 'bottom'
    })
      .setLngLat(comment.location.coordinates)
      .addTo(map);

    // Add click handler
    el.addEventListener('click', () => {
      selectComment(comment.id);
    });

    return { marker, popup };
  }, [map, selectComment]);

  // Setup map click handler for creating new comments
  useEffect(() => {
    if (!map) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!currentRoom) return;

      setCreateDialog({
        open: true,
        location: {
          type: 'Point',
          coordinates: [e.lngLat.lng, e.lngLat.lat]
        }
      });
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, currentRoom]);

  // Update markers when comments change
  useEffect(() => {
    if (!map) return;

    clearMarkers();
    const newMarkers = new Map<string, CommentMarker>();

    comments.forEach(comment => {
      const marker = createCommentMarker(comment);
      if (marker) {
        newMarkers.set(comment.id, marker);
      }
    });

    setMarkers(newMarkers);
  }, [map, comments, clearMarkers, createCommentMarker]);

  // Handle create dialog
  const handleCreateComment = async (input: CommentCreateInput) => {
    try {
      if (!currentRoom) throw new Error('No room selected');
      await createComment(input);
      setCreateDialog({ open: false, location: null });
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  // Render list of comments
  const renderCommentList = () => {
    if (!currentRoom) return null;

    return (
      <Box sx={{ 
        position: 'absolute',
        top: 20,
        left: 20,
        width: 300,
        maxHeight: 'calc(100vh - 120px)',
        backgroundColor: 'white',
        borderRadius: 1,
        boxShadow: 2,
        overflow: 'auto'
      }}>
        <CommentList
          comments={comments}
          loading={loading}
          error={error}
          onSelectComment={(comment) => selectComment(comment.id)}
          onEditComment={updateComment}
          onDeleteComment={(comment) => deleteComment(comment.id)}
          onReplyComment={(comment) => selectComment(comment.id)}
        />
      </Box>
    );
  };

  return (
    <>
      {/* Comment List */}
      {renderCommentList()}

      {/* Create Comment Dialog */}
      {createDialog.location && (
        <CommentCreate
          open={createDialog.open}
          loading={loading}
          error={error}
          location={createDialog.location}
          onClose={() => setCreateDialog({ open: false, location: null })}
          onSubmit={handleCreateComment}
        />
      )}

      {/* Comment Detail View */}
      {selectedComment && (
        <Box sx={{ position: 'absolute', bottom: 20, right: 20, width: 400 }}>
          <CommentDetail
            comment={comments.find(c => c.id === selectedComment)!}
            onClose={() => selectComment(null)}
          />
        </Box>
      )}
    </>
  );
};

export default CommentLayer;