import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

/**
 * DisruptionCallout: Renders a callout box with the current disruption score and classification.
 * Displayed prominently within article content.
 */
export function DisruptionCallout() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['disruption-score', 'current'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/disruption-score/current');
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading) {
    return (
      <div className="border-l-4 border-yellow-500 bg-yellow-950 p-4 my-6 rounded">
        <p className="text-yellow-200">Loading disruption data...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="border-l-4 border-red-500 bg-red-950 p-4 my-6 rounded">
        <p className="text-red-200">Unable to load disruption score</p>
      </div>
    );
  }

  type Classification = 'normal' | 'elevated' | 'high' | 'crisis';
  const classification: Classification = (data.classification as Classification) || 'normal';
  const colors: Record<Classification, string> = {
    normal: 'border-blue-500 bg-blue-950 text-blue-200',
    elevated: 'border-yellow-500 bg-yellow-950 text-yellow-200',
    high: 'border-orange-500 bg-orange-950 text-orange-200',
    crisis: 'border-red-500 bg-red-950 text-red-200',
  };

  return (
    <div className={`border-l-4 ${colors[classification]} p-4 my-6 rounded`}>
      <p className="font-semibold text-lg mb-2">Current Disruption Index</p>
      <p>
        Status: <span className="font-bold capitalize">{classification}</span> (
        <span className="font-mono">{data.score?.toFixed(2) || '—'}</span>)
      </p>
      <p className="text-sm mt-2 opacity-90">
        Weekly change: <span className="font-mono">{data.weeklyChange?.toFixed(2) || '—'}%</span>
      </p>
    </div>
  );
}
