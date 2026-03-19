import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

/**
 * LivePriceInline: Renders the current regular gas price inline within article text.
 * Falls back to a loading state if data is unavailable.
 */
export function LivePriceInline() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['energy-prices', 'current'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/energy-prices/latest', {
        params: { metric: 'gas_regular', region: 'US' },
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) return <span className="text-yellow-400 font-semibold">—</span>;
  if (isError || !data?.value) return <span className="text-red-400">unavailable</span>;

  const price = data.value.toFixed(2);
  return <span className="text-green-400 font-semibold">${price}/gal</span>;
}
