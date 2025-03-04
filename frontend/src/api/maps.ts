// Path: api\maps.ts
import { QueryClient } from '@tanstack/react-query';
import { Map, MapFormData } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

export const fetchMaps = async (): Promise<Map[]> => {
  const response = await fetch(`${API_URL}/maps`);
  if (!response.ok) throw new Error('Failed to fetch maps');
  return response.json();
};

export const fetchMap = async (id: number): Promise<Map> => {
  const response = await fetch(`${API_URL}/maps/${id}`);
  if (!response.ok) throw new Error('Failed to fetch map');
  return response.json();
};

export const createMap = async (data: MapFormData): Promise<Map> => {
  const response = await fetch(`${API_URL}/maps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) throw new Error('Failed to create map');
  return response.json();
};

export const updateMap = async (id: number, data: MapFormData): Promise<Map> => {
  const response = await fetch(`${API_URL}/maps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) throw new Error('Failed to update map');
  return response.json();
};

export const deleteMap = async (id: number): Promise<void> => {
  const response = await fetch(`${API_URL}/maps/${id}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) throw new Error('Failed to delete map');
};

// Prefetch functions for React Query
export const prefetchMaps = (queryClient: QueryClient) => {
  return queryClient.prefetchQuery({
    queryKey: ['maps'],
    queryFn: fetchMaps
  });
};