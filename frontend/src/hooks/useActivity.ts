import { useState, useEffect, useCallback } from 'react';
import { Activity } from '../types';
import { activityApi } from '../utils/api';

interface UseActivityOptions {
  roomId: string | null;
  limit?: number;
  onError?: (error: Error) => void;
}

const DEFAULT_LIMIT = 50;

const useActivity = ({ 
  roomId, 
  limit = DEFAULT_LIMIT,
  onError 
}: UseActivityOptions) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null);

  // Load initial activities
  const loadActivities = useCallback(async (reset: boolean = false) => {
    if (!roomId) return;

    setLoading(true);
    try {
      // If reset is true, clear the state before loading
      if (reset) {
        setActivities([]);
        setLastTimestamp(null);
        setHasMore(false);
      }

      const response = await activityApi.getLog(roomId, { limit });
      setActivities(response);
      setHasMore(response.length >= limit);
      
      if (response.length > 0) {
        setLastTimestamp(response[response.length - 1].timestamp);
      }
      
      setError(null);
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [roomId, limit, onError]);

  // Load more activities
  const loadMore = useCallback(async () => {
    if (!roomId || !lastTimestamp || !hasMore || loading) return;

    setLoading(true);
    try {
      const response = await activityApi.getLog(roomId, {
        before: lastTimestamp,
        limit
      });

      if (response.length > 0) {
        setActivities(prev => [...prev, ...response]);
        setHasMore(response.length >= limit);
        setLastTimestamp(response[response.length - 1].timestamp);
      } else {
        setHasMore(false);
      }
      
      setError(null);
    } catch (error) {
      const err = error as Error;
      setError(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [roomId, lastTimestamp, hasMore, loading, limit, onError]);

  // Reset when room changes
  useEffect(() => {
    if (roomId) {
      loadActivities(true);
    } else {
      setActivities([]);
      setHasMore(false);
      setLastTimestamp(null);
    }
  }, [roomId, loadActivities]);

  // Add new activity to the list
  const addActivity = useCallback((activity: Activity) => {
    setActivities(prev => {
      const newActivities = [activity, ...prev];
      // Keep only the latest activities based on limit
      return newActivities.slice(0, limit);
    });
  }, [limit]);

  // Update user names in existing activities
  const updateUserNames = useCallback((userId: string, newName: string) => {
    setActivities(prev => prev.map(activity => {
      if (activity.userId === userId) {
        return {
          ...activity,
          userName: newName
        };
      }
      return activity;
    }));
  }, []);

  // Get user activities
  const getUserActivities = useCallback(async (userId: string) => {
    if (!roomId) return [];

    try {
      const activities = await activityApi.getUserActivity(roomId, userId);
      return activities;
    } catch (error) {
      const err = error as Error;
      onError?.(err);
      throw err;
    }
  }, [roomId, onError]);

  // Filter activities by type
  const filterActivitiesByType = useCallback((type: Activity['type']) => {
    return activities.filter(activity => activity.type === type);
  }, [activities]);

  // Filter activities by user
  const filterActivitiesByUser = useCallback((userId: string) => {
    return activities.filter(activity => activity.userId === userId);
  }, [activities]);

  return {
    activities,
    loading,
    error,
    hasMore,
    loadActivities,
    loadMore,
    addActivity,
    updateUserNames,
    getUserActivities,
    filterActivitiesByType,
    filterActivitiesByUser
  };
};

export default useActivity;