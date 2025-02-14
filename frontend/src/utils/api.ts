import { 
  Room, RoomDetails, RoomCreateInput, RoomUpdateInput,
  Comment, CommentCreateInput, CommentUpdateInput,
  MapBounds, APIResponse
} from '../types';

// Get base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Generic response handler
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API Error');
  }
  
  const data = await response.json() as APIResponse<T>;
  if (data.status === 'error') {
    throw new Error(data.message);
  }
  
  return data.data;
}

// Room API
export const roomApi = {
  list: async (): Promise<Room[]> => {
    const response = await fetch(`${API_BASE_URL}/api/maps`);
    return handleResponse<Room[]>(response);
  },

  create: async (input: RoomCreateInput): Promise<Room> => {
    const response = await fetch(`${API_BASE_URL}/api/maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Room>(response);
  },

  get: async (uuid: string): Promise<RoomDetails> => {
    const response = await fetch(`${API_BASE_URL}/api/maps/${uuid}`);
    return handleResponse<RoomDetails>(response);
  },

  update: async (uuid: string, input: RoomUpdateInput): Promise<Room> => {
    const response = await fetch(`${API_BASE_URL}/api/maps/${uuid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Room>(response);
  },

  delete: async (uuid: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/maps/${uuid}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// Comment API
export const commentApi = {
  list: async (roomId: string, bounds?: MapBounds): Promise<Comment[]> => {
    const url = new URL(`${API_BASE_URL}/api/maps/${roomId}/comments`);
    if (bounds) {
      url.searchParams.append('bounds', JSON.stringify(bounds));
    }
    const response = await fetch(url.toString());
    return handleResponse<Comment[]>(response);
  },

  create: async (roomId: string, input: CommentCreateInput): Promise<Comment> => {
    const response = await fetch(`${API_BASE_URL}/api/maps/${roomId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Comment>(response);
  },

  update: async (roomId: string, commentId: string, input: CommentUpdateInput): Promise<Comment> => {
    const response = await fetch(`${API_BASE_URL}/api/maps/${roomId}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Comment>(response);
  },

  delete: async (roomId: string, commentId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/maps/${roomId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};