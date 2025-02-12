import { Activity } from '../types';
import { API_ROUTES } from '../types';

interface GetLogOptions {
  before?: string;
  limit?: number;
}

interface APIResponse<T> {
  status: 'success' | 'error';
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Generic response handler
async function handleResponse<T>(response: Response): Promise<T> {
  const data: APIResponse<T> = await response.json();
  if (data.status === 'error') {
    throw new Error(data.error?.message || 'API Error');
  }
  return data.data;
}

export const activityApi = {
  getLog: async (roomId: string, options?: GetLogOptions): Promise<Activity[]> => {
    const url = new URL(API_ROUTES.getActivityLog(roomId), window.location.origin);
    
    url.searchParams.append('limit', (options?.limit || 50).toString());
    
    if (options?.before) {
      url.searchParams.append('before', options.before);
    }

    const response = await fetch(url.toString());
    return handleResponse<Activity[]>(response);
  },

  getUserActivity: async (roomId: string, userId: string): Promise<Activity[]> => {
    const response = await fetch(API_ROUTES.getUserActivity(roomId, userId));
    return handleResponse<Activity[]>(response);
  }
};