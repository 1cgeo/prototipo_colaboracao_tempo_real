import { useState, useEffect, useCallback, useRef } from 'react';
import { Comment, Point } from '../types';

interface UseNearbyCommentsOptions {
  roomId: string | null;
  center: Point | null;
  radius: number; // em metros
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface NearbyCommentsState {
  comments: Comment[];
  loading: boolean;
  error: Error | null;
}

// Constantes para otimização
const DEBOUNCE_TIME = 500; // ms
const MIN_RADIUS = 50; // metros
const MAX_RADIUS = 5000; // metros

const useNearbyComments = ({
  roomId,
  center,
  radius,
  enabled = true,
  onError
}: UseNearbyCommentsOptions) => {
  const [state, setState] = useState<NearbyCommentsState>({
    comments: [],
    loading: false,
    error: null
  });

  // Refs para debounce
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Converter coordenadas para o formato esperado pela API
  const formatCoordinates = (point: Point) => {
    const [lng, lat] = point.coordinates;
    return { lat, lng };
  };

  // Função principal para buscar comentários
  const fetchNearbyComments = useCallback(async (searchCenter: Point, searchRadius: number) => {
    if (!roomId || !enabled) return;

    // Limpar timeout anterior se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Criar novo AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Validar e ajustar radius
    const validRadius = Math.max(MIN_RADIUS, Math.min(searchRadius, MAX_RADIUS));
    const coords = formatCoordinates(searchCenter);

    // Criar novo timeout
    timeoutRef.current = setTimeout(async () => {
      setState(prev => ({ ...prev, loading: true }));

      try {
        const params = new URLSearchParams({
          lat: coords.lat.toString(),
          lng: coords.lng.toString(),
          radius: validRadius.toString()
        });

        const response = await fetch(
          `/api/maps/${roomId}/comments?${params.toString()}`,
          {
            signal: abortController.signal
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch nearby comments');
        }

        const data = await response.json();
        setState({
          comments: data.data,
          loading: false,
          error: null
        });
      } catch (error) {
        // Ignore abort errors
        if ((error as Error).name === 'AbortError') return;

        const err = error as Error;
        setState(prev => ({
          ...prev,
          loading: false,
          error: err
        }));
        onError?.(err);
      }
    }, DEBOUNCE_TIME);
  }, [roomId, enabled, onError]);

  // Efeito para buscar comentários quando o centro ou raio mudam
  useEffect(() => {
    if (center) {
      fetchNearbyComments(center, radius);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [center, radius, fetchNearbyComments]);

  // Função para limpar os comentários
  const clearComments = useCallback(() => {
    setState({
      comments: [],
      loading: false,
      error: null
    });
  }, []);

  // Função para forçar uma atualização
  const refetch = useCallback(() => {
    if (center) {
      fetchNearbyComments(center, radius);
    }
  }, [center, radius, fetchNearbyComments]);

  return {
    comments: state.comments,
    loading: state.loading,
    error: state.error,
    clearComments,
    refetch
  };
};

export default useNearbyComments;