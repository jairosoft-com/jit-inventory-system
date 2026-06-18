import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

import authRouter from './routes/auth.routes.js';
import usersRouter from './routes/users.routes.js';
import categoriesRouter from './routes/categories.routes.js';
import equipmentRouter from './routes/equipment.routes.js';
import itemsRouter from './routes/items.routes.js';
import inventoryRouter from './routes/inventory.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import borrowRouter from './routes/borrow.routes.js';
import suppliersRouter from './routes/suppliers.routes.js';

const app = express();

// Security Headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

import {
  globalLimiter,
  mutativeLimiter,
  authLimiter,
  heavyLimiter,
} from './middleware/rateLimiters.js';

// Cookie Parser
app.use(cookieParser());

// ── Tiered Rate Limiting ────────────────────────
app.use('/api', globalLimiter); // Bucket 1: 600 req/15min
app.use('/api/auth', authLimiter); // Bucket 3: 15 req/15min
app.use('/api/dashboard', heavyLimiter); // Bucket 4: 30 req/15min
app.use('/api/inventory', mutativeLimiter); // Bucket 2: 120 write/15min
app.use('/api/items', mutativeLimiter); // Bucket 2
app.use('/api/equipment', mutativeLimiter); // Bucket 2
app.use('/api/borrow', mutativeLimiter); // Bucket 2
app.use('/api/categories', mutativeLimiter); // Bucket 2
app.use('/api/users', mutativeLimiter); // Bucket 2

// Body Parser
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/items', itemsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/borrow', borrowRouter);
app.use('/api/suppliers', suppliersRouter);

// Health Check
app.get('/api/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start Server
const port = env.BACKEND_PORT || 3001;
const server = app.listen(port, () => {
  console.log(
    `[Server] Backend listening on port ${port} in ${env.NODE_ENV} mode`,
  );
});

// Graceful shutdown
const shutdown = () => {
  console.log('[Server] Shutting down gracefully...');

  // Fallback timeout to force exit if server.close hangs (e.g. active connections)
  const forceExitTimeout = setTimeout(() => {
    console.error(
      '[Server] Could not close connections in time, forcefully shutting down',
    );
    process.exit(1);
  }, 10000);

  server.close(() => {
    console.log('[Server] HTTP server closed.');
    Promise.all([prisma.$disconnect(), redis.quit()])
      .then(() => {
        console.log('[Server] DB and Redis connections closed. Exiting.');
        clearTimeout(forceExitTimeout);
        process.exit(0);
      })
      .catch((err) => {
        console.error('[Server] Error during connection shutdown:', err);
        clearTimeout(forceExitTimeout);
        process.exit(1);
      });
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
