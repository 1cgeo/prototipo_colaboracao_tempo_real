import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useMap } from '../../contexts/MapContext';
import { useCollaboration } from '../../contexts/CollaborationContext';
import CursorLayer from './CursorLayer';
import CommentLayer from './CommentLayer';

const MapView: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const { initializeMap, destroyMap } = useMap();
  const { currentRoom } = useCollaboration();

  // Initialize map
  useEffect(() => {
    if (mapContainer.current) {
      initializeMap(mapContainer.current);
    }

    return () => {
      destroyMap();
    };
  }, [initializeMap, destroyMap]);

  return (
    <Box
      ref={mapContainer}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        '& .maplibregl-canvas': {
          outline: 'none'
        }
      }}
    >
      {currentRoom && (
        <>
          <CursorLayer />
          <CommentLayer />
        </>
      )}
    </Box>
  );
};

export default MapView;