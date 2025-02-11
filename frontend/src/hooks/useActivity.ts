import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, ActivityType, UIActivity, toCamelCase } from '../types';
import { activityApi, getSocket } from '../utils/api';

interface UseActivityOptions {
  roomId: string | null;
  limit?: number;
  onError?: (error: Error) => void;
}

interface ActivitySummary {
  totalActivities: number;
  byType: Record<ActivityType, number>;
  byUser: Record<string, {
    count: number;
    lastActivity: string;
    userName: string;
  }>;
  mostActiveUsers: Array<{
    userId: string;
    userName: string;
    count: number;
  }>;
  recentActivityRate: number;
}

const DEFAULT_LIMIT = 50;
const ACTIVITY_BUFFER_SIZE = 500;

const useActivity = ({ 
  roomId, 
  limit = DEFAULT_LIMIT,
  onError 
}: UseActivityOptions) => {
  const [activities, setActivities] = useState<UIActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState<string | undefined>(undefined);
  const loadingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Convert Activity to UIActivity
  const convertActivity = useCallback((activity: Activity): UIActivity => {
    return {
      id: activity.id,
      type: activity.type,
      userId: activity.user_id,
      userName: activity.user_name,
      metadata: activity.metadata,
      createdAt: activity.created_at
    };
  }, []);

  // Load activities
  const loadActivities = useCallback(async (reset: boolean = false) => {
    if (!roomId || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const response = await activityApi.getLog(roomId, { 
        before: reset ? undefined : lastTimestamp,
        limit
      });
      
      if (!isMountedRef.current) return;

      setActivities(prev => {
        const newActivities = reset 
          ? response.map(convertActivity)
          : [...prev, ...response.map(convertActivity)];
        return newActivities.slice(-ACTIVITY_BUFFER_SIZE);
      });
      
      setHasMore(response.length >= limit);
      
      if (response.length > 0) {
        setLastTimestamp(response[response.length - 1].created_at);
      }
      
      setError(null);
    } catch (error) {
      if (!isMountedRef.current) return;
      const err = error as Error;
      setError(err);
      onError?.(err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  }, [roomId, limit, lastTimestamp, onError, convertActivity]);

  // Load more function
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadActivities(false);
  }, [hasMore, loading, loadActivities]);

  // Subscribe to activity events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    const handleActivity = (activity: Activity) => {
      setActivities(prev => {
        const newActivities = [convertActivity(activity), ...prev];
        return newActivities.slice(0, ACTIVITY_BUFFER_SIZE);
      });
    };

    socket.on('activity', handleActivity);

    return () => {
      socket.off('activity', handleActivity);
    };
  }, [roomId, convertActivity]);

  // Reset when room changes
  useEffect(() => {
    if (roomId) {
      loadActivities(true);
    } else {
      setActivities([]);
      setHasMore(false);
      setLastTimestamp(undefined);
    }
  }, [roomId, loadActivities]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Add new activity
  const addActivity = useCallback((activity: Activity) => {
    setActivities(prev => {
      const newActivities = [convertActivity(activity), ...prev];
      return newActivities.slice(0, ACTIVITY_BUFFER_SIZE);
    });
  }, [convertActivity]);

  // Filter activities by type
  const filterByType = useCallback((type: ActivityType) => {
    return activities.filter(activity => activity.type === type);
  }, [activities]);

  // Filter activities by user
  const filterByUser = useCallback((userId: string) => {
    return activities.filter(activity => activity.userId === userId);
  }, [activities]);

  // Get user activities
  const getUserActivities = useCallback(async (userId: string, limit: number = 10) => {
    if (!roomId) return [];

    try {
      const activities = await activityApi.getUserActivity(roomId, userId);
      return activities.map(convertActivity).slice(0, limit);
    } catch (error) {
      const err = error as Error;
      onError?.(err);
      throw err;
    }
  }, [roomId, onError, convertActivity]);

  // Get activity summary
  const getActivitySummary = useCallback((): ActivitySummary => {
    const summary: ActivitySummary = {
      totalActivities: activities.length,
      byType: {},
      byUser: {},
      mostActiveUsers: [],
      recentActivityRate: 0
    };

    // Calculate metrics
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    let recentCount = 0;

    activities.forEach(activity => {
      // By type
      summary.byType[activity.type] = (summary.byType[activity.type] || 0) + 1;

      // By user
      if (!summary.byUser[activity.userId]) {
        summary.byUser[activity.userId] = {
          count: 0,
          lastActivity: activity.createdAt,
          userName: activity.userName
        };
      }
      summary.byUser[activity.userId].count += 1;

      if (activity.createdAt > summary.byUser[activity.userId].lastActivity) {
        summary.byUser[activity.userId].lastActivity = activity.createdAt;
      }

      // Recent activity count
      if (new Date(activity.createdAt).getTime() >= fiveMinutesAgo) {
        recentCount += 1;
      }
    });

    // Calculate most active users
    summary.mostActiveUsers = Object.entries(summary.byUser)
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate activity rate (per minute)
    summary.recentActivityRate = recentCount / 5;

    return summary;
  }, [activities]);

  return {
    activities,
    loading,
    error,
    hasMore,
    loadActivities,
    loadMore,
    addActivity,
    filterByType,
    filterByUser,
    getUserActivities,
    getActivitySummary
  };
};

export default useActivity;