// Application Insights MUST be initialized before any other imports
// so it can instrument http/https for automatic dependency tracking.
import { initAppInsights } from './lib/appInsights';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables first so the connection string is available
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
initAppInsights();

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import pricesRouter from './routes/prices';
import disruptionRouter from './routes/disruption';
import impactRouter from './routes/impact';
import correlationRouter from './routes/correlation';
import eventsRouter from './routes/events';
import adminRouter from './routes/admin';
import supplyRouter from './routes/supply';
import llmRouter from './routes/llm';
import aaaRouter from './routes/aaa';
import healthRouter from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { initializeCache } from './services/cache';
import { initializeJobQueue } from './services/jobQueue';
import { warmDashboardCache } from './services/cacheWarmer';

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Trust the first proxy (Azure Front Door / App Service)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS — support comma-separated origins in CORS_ORIGIN env var
const allowedOrigins = (
  process.env.CORS_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no Origin header (health checks, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`⚠️  CORS blocked origin: ${origin}  (allowed: ${allowedOrigins.join(', ')})`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // Azure Front Door / App Service may forward ip:port — strip the port suffix
  keyGenerator: (req) => {
    const forwarded = req.ip || req.socket.remoteAddress || 'unknown';
    // Strip port suffix if present (e.g. '147.243.248.73:48446' → '147.243.248.73')
    return forwarded.replace(/:\d+$/, '');
  },
});
app.use('/api/', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cors: allowedOrigins,
    database: !!process.env.DATABASE_URL,
    redis: !!process.env.REDIS_URL,
  });
});

// API routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/prices', pricesRouter);
app.use('/api/v1/disruption', disruptionRouter);
app.use('/api/v1/impact', impactRouter);
app.use('/api/v1/correlation', correlationRouter);
app.use('/api/v1/events', eventsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/supply', supplyRouter);
app.use('/api/v1/llm', llmRouter);
app.use('/api/v1/aaa', aaaRouter);

// Error handling
app.use(errorHandler);

// Initialize cache
initializeCache();

// Initialize job queue
initializeJobQueue();

// Start server (skip in test mode — supertest binds its own ephemeral port)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 FuelRipple API server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS origins: ${allowedOrigins.join(', ')}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'configured' : '⚠️  NOT SET'}`);
    console.log(`📦 Redis: ${process.env.REDIS_URL ? 'configured' : 'not configured (L1 only)'}`);

    // Pre-populate cache in background — don't await, don't block incoming requests
    warmDashboardCache(PORT).catch((err) =>
      console.warn('⚠️  Cache warm error:', err.message)
    );
  });
}

export default app;
