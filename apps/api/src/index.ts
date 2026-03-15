import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import pricesRouter from './routes/prices';
import disruptionRouter from './routes/disruption';
import impactRouter from './routes/impact';
import correlationRouter from './routes/correlation';
import eventsRouter from './routes/events';
import adminRouter from './routes/admin';
import supplyRouter from './routes/supply';
import llmRouter from './routes/llm';
import { errorHandler } from './middleware/errorHandler';
import { initializeCache } from './services/cache';
import { initializeJobQueue } from './services/jobQueue';

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/prices', pricesRouter);
app.use('/api/v1/disruption', disruptionRouter);
app.use('/api/v1/impact', impactRouter);
app.use('/api/v1/correlation', correlationRouter);
app.use('/api/v1/events', eventsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/supply', supplyRouter);
app.use('/api/v1/llm', llmRouter);

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
  });
}

export default app;
