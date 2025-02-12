import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, ActivityType } from '../types';
import { activityApi } from '../utils/activityApi';
import { getSocket } from '../utils/api';

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
  recentActivityRate: number; // activities per minute in last 5 minutes
}

const DEFAULT_LIMIT = 50;
const ACTIVITY_BUFFER_SIZE = 500;

const useActivity = ({ 
  roomId, 
  limit = DEFAULT_LIMIT,
  onError 
}: UseActivityOptions) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Load activities
  const loadActivities = useCallback(async (reset: boolean = false) => {
    if (!roomId || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      // Se for reset, não usa cursor de paginação
      // Se não for reset, usa a data da última atividade como cursor
      const options = reset ? { limit } : {
        limit,
        before: activities[activities.length - 1]?.created_at
      };

      const response = await activityApi.getLog(roomId, options);
      
      if (!isMountedRef.current) return;

      setActivities(prev => {
        const newActivities = reset ? response : [...prev, ...response];
        // Manter buffer size para performance
        return newActivities.slice(-ACTIVITY_BUFFER_SIZE);
      });
      
      // Se recebemos menos itens que o limite, não há mais para carregar
      setHasMore(response.length >= limit);
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
  }, [roomId, limit, activities, onError]);

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
        const newActivities = [activity, ...prev];
        return newActivities.slice(0, ACTIVITY_BUFFER_SIZE);
      });
    };

    socket.on('activity', handleActivity);

    return () => {
      socket.off('activity', handleActivity);
    };
  }, [roomId]);

  // Reset when room changes
  useEffect(() => {
    if (roomId) {
      loadActivities(true);
    } else {
      setActivities([]);
      setHasMore(false);
    }
  }, [roomId, loadActivities]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get activity summary
  const getActivitySummary = useCallback((): ActivitySummary => {
    const summary: ActivitySummary = {
      totalActivities: activities.length,
      byType: {
        'ROOM_JOIN': 0,
        'ROOM_LEAVE': 0,
        'COMMENT_CREATE': 0,
        'COMMENT_UPDATE': 0,
        'COMMENT_DELETE': 0,
        'REPLY_CREATE': 0,
        'REPLY_UPDATE': 0,
        'REPLY_DELETE': 0
      },
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
      summary.byType[activity.type] += 1;

      // By user
      if (!summary.byUser[activity.user_id]) {
        summary.byUser[activity.user_id] = {
          count: 0,
          lastActivity: activity.created_at,
          userName: activity.user_name
        };
      }
      summary.byUser[activity.user_id].count += 1;

      if (activity.created_at > summary.byUser[activity.user_id].lastActivity) {
        summary.byUser[activity.user_id].lastActivity = activity.created_at;
      }

      // Recent activity count
      if (new Date(activity.created_at).getTime() >= fiveMinutesAgo) {
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
    getActivitySummary
  };
};

export default useActivity;