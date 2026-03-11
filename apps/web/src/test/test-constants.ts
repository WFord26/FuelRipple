/**
 * Global test constants for React testing
 */

export const TEST_TIMEOUT = 5000;

/**
 * Mock data for React testing
 */
export const MOCK_DATA = {
  prices: [
    { date: '2024-01-01', value: 3.45, region: 'US-East' },
    { date: '2024-01-02', value: 3.50, region: 'US-East' },
    { date: '2024-01-03', value: 3.42, region: 'US-East' },
  ],
  events: [
    { id: '1', date: '2024-01-01', type: 'supply_disruption', severity: 5 },
    { id: '2', date: '2024-01-02', type: 'refinery_outage', severity: 3 },
  ],
  regions: [
    { id: 'us-east', name: 'East Coast' },
    { id: 'us-west', name: 'West Coast' },
    { id: 'us-midwest', name: 'Midwest' },
  ],
};

/**
 * Helper to create mock API responses
 */
export const createMockResponse = (data: any, status = 200) => {
  return {
    status,
    data,
    ok: status >= 200 && status < 300,
  };
};

/**
 * Helper to create mock chart data
 */
export const createMockChartData = (points: number = 30) => {
  const data = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      value: (Math.random() * 2 + 2.5).toFixed(2),
    });
  }
  return data;
};

/**
 * Common screen query helpers
 */
export const getByTestId = (id: string) => `[data-testid="${id}"]`;
export const getByAriaLabel = (label: string) => `[aria-label="${label}"]`;
