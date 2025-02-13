import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Comment, CommentCreateInput, CommentUpdateInput } from '../types';
import { commentApi } from '../utils/api';
import { useCollaboration } from './CollaborationContext';

interface MapContextState {
  map: maplibregl.Map | null;
  center: [number, number];
  zoom: number;
  bounds: maplibregl.LngLatBounds | null;
  comments: Comment[];
  selectedComment: string | null;
  loading: boolean;
  error: Error | null;
}

interface MapContextActions {
  initializeMap: (container: HTMLElement) => void;
  destroyMap: () => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  createComment: (input: CommentCreateInput) => Promise<Comment>;
  updateComment: (commentId: string, input: CommentUpdateInput) => Promise<Comment>;
  deleteComment: (commentId: string) => Promise<void>;
  selectComment: (commentId: string | null) => void;
}

const MapContext = createContext<
  | (MapContextState & MapContextActions)
  | undefined
>(undefined);

interface MapProviderProps {
  children: React.ReactNode;
}

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const { currentRoom, socket } = useCollaboration();

  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [center, setCenter] = useState<[number, number]>([-74.5, 40]);
  const [zoom, setZoom] = useState(9);
  const [bounds, setBounds] = useState<maplibregl.LngLatBounds | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use ref for map instance to avoid dependency cycles
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Handler for map movement
  const handleMapMove = useCallback((eventMap: maplibregl.Map) => {
    const center = eventMap.getCenter();
    setCenter([center.lng, center.lat]);
    setZoom(eventMap.getZoom());
    setBounds(eventMap.getBounds());
  }, []);

  // Cleanup map resources
  const cleanupMap = useCallback(() => {
    if (mapRef.current) {
      try {
        const currentMap = mapRef.current;
        
        // Remove event listeners
        currentMap.off('move', handleMapMove);
        
        // Remove markers if any
        const markers = document.querySelectorAll('.maplibregl-marker');
        markers.forEach(marker => marker.remove());
        
        // Remove map
        currentMap.remove();
        
        // Reset states
        mapRef.current = null;
        setMap(null);
        setBounds(null);
      } catch (err) {
        console.error('Error cleaning up map:', err);
      }
    }
  }, [handleMapMove]);

  // Initialize map
  const initializeMap = useCallback((container: HTMLElement) => {
    // Cleanup existing map if any
    cleanupMap();

    try {
      const newMap = new maplibregl.Map({
        container,
        style: 'https://demotiles.maplibre.org/style.json',
        center,
        zoom,
      });

      // Store map instance in both state and ref
      newMap.on('move', () => handleMapMove(newMap));
      mapRef.current = newMap;
      setMap(newMap);
      setError(null);
    } catch (err) {
      console.error('Error initializing map:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize map'));
    }
  }, [center, zoom, handleMapMove, cleanupMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMap();
    };
  }, [cleanupMap]);

  // Load comments when room changes
  useEffect(() => {
    if (!currentRoom) {
      setComments([]);
      setSelectedComment(null);
      return;
    }

    const loadComments = async () => {
      setLoading(true);
      try {
        const comments = await commentApi.list(currentRoom.uuid);
        setComments(comments);
        setError(null);
      } catch (error) {
        setError(error as Error);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [currentRoom]);

  // Handle comment WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleCommentCreate = (comment: Comment) => {
      setComments(prev => [...prev, comment]);
    };

    const handleCommentUpdate = (comment: Comment) => {
      setComments(prev => 
        prev.map(c => c.id === comment.id ? comment : c)
      );
    };

    const handleCommentDelete = (commentId: string) => {
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (selectedComment === commentId) {
        setSelectedComment(null);
      }
    };

    socket.on('comment:create', handleCommentCreate);
    socket.on('comment:update', handleCommentUpdate);
    socket.on('comment:delete', handleCommentDelete);

    return () => {
      socket.off('comment:create', handleCommentCreate);
      socket.off('comment:update', handleCommentUpdate);
      socket.off('comment:delete', handleCommentDelete);
    };
  }, [socket, selectedComment]);

  // Comment actions
  const createComment = async (input: CommentCreateInput): Promise<Comment> => {
    if (!currentRoom) throw new Error('No room selected');

    try {
      const comment = await commentApi.create(currentRoom.uuid, input);
      setComments(prev => [...prev, comment]);
      return comment;
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  const updateComment = async (
    commentId: string, 
    input: CommentUpdateInput
  ): Promise<Comment> => {
    if (!currentRoom) throw new Error('No room selected');

    try {
      const comment = await commentApi.update(currentRoom.uuid, commentId, input);
      setComments(prev => 
        prev.map(c => c.id === comment.id ? comment : c)
      );
      return comment;
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  const deleteComment = async (commentId: string): Promise<void> => {
    if (!currentRoom) throw new Error('No room selected');

    try {
      await commentApi.delete(currentRoom.uuid, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (selectedComment === commentId) {
        setSelectedComment(null);
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  const value: MapContextState & MapContextActions = {
    map,
    center,
    zoom,
    bounds,
    comments,
    selectedComment,
    loading,
    error,
    initializeMap,
    destroyMap: cleanupMap,
    setCenter: (center: [number, number]) => {
      if (mapRef.current) mapRef.current.setCenter(center);
    },
    setZoom: (zoom: number) => {
      if (mapRef.current) mapRef.current.setZoom(zoom);
    },
    createComment,
    updateComment,
    deleteComment,
    selectComment: setSelectedComment,
  };

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
};