import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

/**
 * Fetch API version information
 * Cached with 1 hour stale time since version doesn't change often
 */
export const useApiVersion = () => {
  return useQuery({
    queryKey: ['api-version'],
    queryFn: async () => {
      const response = await apiClient.get<HealthResponse>('/health');
      return response.data.version;
    },
    // Cache for 1 hour since version doesn't change frequently
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000, // 24 hour garbage collection time
    retry: 1,
  });
};
