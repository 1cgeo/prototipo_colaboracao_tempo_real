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
  recentActivityRate: number;
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
  const [lastTimestamp, setLastTimestamp] = useState<string | undefined>(undefined);
  const loadingRef = useRef(false);
  const roomIdRef = useRef(roomId);

  // Update roomId ref when it changes
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Load activities
  const loadActivities = useCallback(async (reset: boolean = false) => {
    const currentRoomId = roomIdRef.current;
    if (!currentRoomId || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const response = await activityApi.getLog(currentRoomId, { 
        before: reset ? undefined : lastTimestamp,
        limit
      });
      
      setActivities(prev => {
        const newActivities = reset 
          ? response
          : [...prev, ...response];
        return newActivities.slice(-ACTIVITY_BUFFER_SIZE);
      });
      
      setHasMore(response.length >= limit);
      
      if (response.length > 0) {
        setLastTimestamp(response[response.length - 1].created_at);
      }
      
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load activities');
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [lastTimestamp, limit, onError]); // Remove roomId da dependência e use a ref

  // Load more function - agora é assíncrona
  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || loading) return;
    return loadActivities(false);
  }, [hasMore, loading, loadActivities]);

  // Initial load and room change handler
  useEffect(() => {
    if (roomId) {
      loadActivities(true);
    } else {
      setActivities([]);
      setHasMore(false);
      setLastTimestamp(undefined);
    }
  }, [roomId, loadActivities]); // É seguro incluir loadActivities agora que removemos roomId das suas dependências

  // Handle real-time activities via WebSocket
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

  // Activity summary calculation
  const getActivitySummary = useCallback((): ActivitySummary => {
    const summary: ActivitySummary = {
      totalActivities: activities.length,
      byType: {
        'USER_JOINED': 0,
        'USER_LEFT': 0,
        'COMMENT_CREATED': 0,
        'COMMENT_UPDATED': 0,
        'COMMENT_DELETED': 0,
        'REPLY_CREATED': 0,
        'REPLY_UPDATED': 0,
        'REPLY_DELETED': 0
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
    loadMore,
    getActivitySummary
  };
};

export default useActivity;