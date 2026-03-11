import { Router } from 'express';
import { dataQueue } from '../services/jobQueue';
import { clearCache } from '../services/cache';

const router = Router();

/**
 * Manually trigger data ingestion jobs
 */
router.post('/trigger-jobs', async (req, res) => {
  try {
    if (!dataQueue) {
      return res.status(503).json({ error: 'Job queue not available' });
    }

    // Clean up stale failed/active jobs before triggering fresh ones
    await dataQueue.clean(0, 1000, 'failed');
    await dataQueue.clean(0, 1000, 'active');

    // Trigger all data fetching jobs
    await dataQueue.add('fetch-eia-gas', {}, { priority: 1 });
    await dataQueue.add('fetch-eia-crude', {}, { priority: 2 });
    await dataQueue.add('fetch-eia-diesel', {}, { priority: 3 });
    await dataQueue.add('fetch-fred-indicators', {}, { priority: 4 });
    await dataQueue.add('fetch-aaa-prices', {}, { priority: 5 });
    await dataQueue.add('fetch-eia-refinery', {}, { priority: 6 });

    res.json({
      message: 'Jobs triggered successfully',
      jobs: ['fetch-eia-gas', 'fetch-eia-crude', 'fetch-eia-diesel', 'fetch-fred-indicators', 'fetch-aaa-prices', 'fetch-eia-refinery']
    });
  } catch (error) {
    console.error('Error triggering jobs:', error);
    res.status(500).json({ error: 'Failed to trigger jobs' });
  }
});

/**
 * Get job queue status
 */
router.get('/queue-status', async (req, res) => {
  try {
    if (!dataQueue) {
      return res.status(503).json({ error: 'Job queue not available' });
    }

    const [waiting, active, completed, failed] = await Promise.all([
      dataQueue.getWaitingCount(),
      dataQueue.getActiveCount(),
      dataQueue.getCompletedCount(),
      dataQueue.getFailedCount(),
    ]);

    res.json({
      waiting,
      active,
      completed,
      failed,
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

/**
 * POST /api/v1/admin/flush-cache
 * Flush all price caches so fresh data is served immediately
 */
router.post('/flush-cache', async (req, res) => {
  try {
    // Clear L1 + L2 for all price and supply cache keys
    await Promise.all([
      clearCache('prices:*'),
      clearCache('supply:*'),
      clearCache('correlation:*'),
      clearCache('disruption:*'),
    ]);
    res.json({ message: 'Cache flushed successfully' });
  } catch (error) {
    console.error('Error flushing cache:', error);
    res.status(500).json({ error: 'Failed to flush cache' });
  }
});

export default router;
