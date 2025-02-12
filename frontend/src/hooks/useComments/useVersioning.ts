import { useRef } from 'react';
import { PendingChange, VersionTracking } from './types';

export const useVersioning = () => {
  const pendingChanges = useRef<Map<string, PendingChange>>(new Map());
  const lastSuccessfulVersion = useRef<Map<string, number>>(new Map());

  const trackVersion = (entityType: 'comment' | 'reply', entityId: string, version: number) => {
    lastSuccessfulVersion.current.set(`${entityType}-${entityId}`, version);
  };

  const removeVersionTracking = (entityType: 'comment' | 'reply', entityId: string) => {
    lastSuccessfulVersion.current.delete(`${entityType}-${entityId}`);
    pendingChanges.current.delete(`${entityType}-${entityId}`);
  };

  const addPendingChange = (
    entityType: 'comment' | 'reply',
    entityId: string,
    change: Omit<PendingChange, 'entityId' | 'entityType'>
  ) => {
    pendingChanges.current.set(`${entityType}-${entityId}`, {
      ...change,
      entityId,
      entityType
    });
  };

  const removePendingChange = (entityType: 'comment' | 'reply', entityId: string) => {
    pendingChanges.current.delete(`${entityType}-${entityId}`);
  };

  const getPendingChange = (entityType: 'comment' | 'reply', entityId: string) => {
    return pendingChanges.current.get(`${entityType}-${entityId}`);
  };

  const getLastVersion = (entityType: 'comment' | 'reply', entityId: string) => {
    return lastSuccessfulVersion.current.get(`${entityType}-${entityId}`);
  };

  const getTracking = (): VersionTracking => ({
    pendingChanges: pendingChanges.current,
    lastSuccessfulVersion: lastSuccessfulVersion.current
  });

  return {
    trackVersion,
    removeVersionTracking,
    addPendingChange,
    removePendingChange,
    getPendingChange,
    getLastVersion,
    getTracking
  };
};