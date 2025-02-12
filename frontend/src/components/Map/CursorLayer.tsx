import React, { useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../contexts/MapContext';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { Point } from '../../types';

const CursorLayer: React.FC = () => {
  const { map } = useMap();
  const { users, cursors, updateCursor } = useCollaboration();

  // Update cursor position on mouse move
  const handleMouseMove = useCallback((event: maplibregl.MapMouseEvent) => {
    const point: Point = {
      type: 'Point',
      coordinates: [event.lngLat.lng, event.lngLat.lat]
    };
    updateCursor(point);
  }, [updateCursor]);

  // Setup mouse move handler
  useEffect(() => {
    if (!map) return;

    map.on('mousemove', handleMouseMove);

    return () => {
      map.off('mousemove', handleMouseMove);
    };
  }, [map, handleMouseMove]);

  // Setup cursor markers
  useEffect(() => {
    if (!map) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.cursor-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Create new markers for each cursor
    Object.entries(cursors).forEach(([userId, cursor]) => {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      // Create cursor element
      const el = document.createElement('div');
      el.className = 'cursor-marker';
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.position = 'relative';

      // Create cursor pointer
      const pointer = document.createElement('div');
      pointer.style.position = 'absolute';
      pointer.style.width = '0';
      pointer.style.height = '0';
      pointer.style.borderLeft = '10px solid transparent';
      pointer.style.borderRight = '10px solid transparent';
      pointer.style.borderBottom = '20px solid rgba(25, 118, 210, 0.6)';
      pointer.style.transform = 'rotate(-45deg)';
      el.appendChild(pointer);

      // Create user label
      const label = document.createElement('div');
      label.style.position = 'absolute';
      label.style.top = '20px';
      label.style.left = '10px';
      label.style.background = 'rgba(25, 118, 210, 0.9)';
      label.style.color = 'white';
      label.style.padding = '2px 6px';
      label.style.borderRadius = '4px';
      label.style.fontSize = '12px';
      label.style.whiteSpace = 'nowrap';
      label.textContent = user.display_name;
      el.appendChild(label);

      // Add marker to map
      new maplibregl.Marker({
        element: el,
        anchor: 'top-left'
      })
        .setLngLat(cursor.location.coordinates)
        .addTo(map);
    });
  }, [map, cursors, users]);

  return null;
};

export default CursorLayer;