import React, { useState, useMemo } from 'react';
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
import useNearbyComments from '../../hooks/useNearbyComments';

interface CreateDialogState {
  open: boolean;
  location: Point | null;
}

const SEARCH_RADIUS = 1000; // 1km raio de busca padrão

const CommentLayer: React.FC = () => {
  const { map } = useMap();
  const { currentRoom } = useCollaboration();
  const [selectedComment, setSelectedComment] = useState<string | null>(null);

  // Estado para o dialog de criação
  const [createDialog, setCreateDialog] = useState<CreateDialogState>({
    open: false,
    location: null
  });

  // Calcular centro atual do mapa
  const currentCenter = useMemo((): Point | null => {
    if (!map) return null;
    const center = map.getCenter();
    return {
      type: 'Point',
      coordinates: [center.lng, center.lat] as [number, number]
    };
  }, [map]);

  // Hook para comentários próximos
  const {
    comments,
    loading,
    error,
    refetch: refetchNearbyComments
  } = useNearbyComments({
    roomId: currentRoom?.uuid || null,
    center: currentCenter,
    radius: SEARCH_RADIUS,
    enabled: !!currentRoom
  });

  // Hook principal de comentários para operações CRUD
  const { 
    createComment, 
    updateComment,
    deleteComment,
  } = useComments({
    roomId: currentRoom?.uuid || null,
    onError: (error) => {
      console.error('Comments operation failed:', error);
    }
  });

  // Setup map click handler for creating new comments
  React.useEffect(() => {
    if (!map) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!currentRoom) return;

      setCreateDialog({
        open: true,
        location: {
          type: 'Point',
          coordinates: [e.lngLat.lng, e.lngLat.lat] as [number, number]
        }
      });
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, currentRoom]);

  // Handler para criação de comentário
  const handleCreateComment = async (input: CommentCreateInput) => {
    try {
      if (!currentRoom) throw new Error('No room selected');
      await createComment(input);
      setCreateDialog({ open: false, location: null });
      // Atualizar lista de comentários próximos
      refetchNearbyComments();
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  // Handler para atualização de comentário
  const handleUpdateComment = async (comment: Comment) => {
    try {
      await updateComment(comment.id, {
        content: comment.content,
        version: comment.version
      });
      refetchNearbyComments();
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  // Handler para deleção de comentário
  const handleDeleteComment = async (comment: Comment) => {
    try {
      await deleteComment(comment.id, comment.version);
      if (selectedComment === comment.id) {
        setSelectedComment(null);
      }
      refetchNearbyComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Render lista de comentários
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
          onSelectComment={(comment) => setSelectedComment(comment.id)}
          onEditComment={handleUpdateComment}
          onDeleteComment={handleDeleteComment}
          onReplyComment={(comment) => setSelectedComment(comment.id)}
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
            onClose={() => setSelectedComment(null)}
          />
        </Box>
      )}
    </>
  );
};

export default CommentLayer;