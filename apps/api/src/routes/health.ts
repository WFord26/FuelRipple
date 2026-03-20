import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Cache package.json version at startup
let apiVersion: string | null = null;

function getApiVersion(): string {
  if (!apiVersion) {
    try {
      const packageJsonPath = path.resolve(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      apiVersion = packageJson.version ?? 'unknown';
    } catch (error) {
      console.error('Failed to read API version from package.json:', error);
      apiVersion = 'unknown';
    }
  }
  return apiVersion as string;
}

/**
 * GET /api/v1/health
 * Returns health status and version information
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: getApiVersion(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
