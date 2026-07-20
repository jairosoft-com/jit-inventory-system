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
import reportsRouter from './routes/reports.routes.js';
import procurementRouter from './routes/procurement.routes.js';
import alertsRouter from './routes/alerts.routes.js';
import { MaintenanceReminderService } from './services/maintenance-reminder.service.js';
import { errorHandler } from './middleware/errorHandler.js';
import maintenanceLogsRouter from './routes/maintenance-logs.routes.js';
import maintenanceAlertsRouter from './routes/maintenance-alerts.routes.js';
import { AlertService } from './services/alert.service.js';
import procurementAlertsRouter from './routes/procurement-alerts.routes.js';
import { startCronJobs } from './lib/cron.js';
import auditLogsRouter from './routes/audit-logs.routes.js';

const app = express();

// Trust the reverse proxy (if any) so req.ip / req.secure reflect the real
// client instead of the proxy. Without this, every request behind a proxy
// looks like it comes from the same IP, which collapses all users into one
// rate-limit bucket. See TRUST_PROXY in .env.example.
if (env.TRUST_PROXY) {
  const trustProxyValue =
    env.TRUST_PROXY === 'true'
      ? true
      : Number.isNaN(Number(env.TRUST_PROXY))
        ? env.TRUST_PROXY
        : Number(env.TRUST_PROXY);
  app.set('trust proxy', trustProxyValue);
}

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
app.use('/api/auth', authLimiter); // Bucket 3a: namespace-wide ceiling (see RATE_LIMIT_AUTH); real brute-force protection lives on POST /auth/login itself
app.use('/api/dashboard', heavyLimiter); // Bucket 4: 30 req/15min
app.use('/api/inventory', mutativeLimiter); // Bucket 2: 120 write/15min
app.use('/api/items', mutativeLimiter); // Bucket 2
app.use('/api/equipment', mutativeLimiter); // Bucket 2
app.use('/api/borrow', mutativeLimiter); // Bucket 2
app.use('/api/categories', mutativeLimiter); // Bucket 2
app.use('/api/users', mutativeLimiter); // Bucket 2
app.use('/api/suppliers', mutativeLimiter); // Bucket 2
app.use('/api/maintenance-logs', mutativeLimiter); // Bucket 2
app.use('/api/reports', heavyLimiter); // Bucket 4: report generation is heavy
app.use('/api/alerts', globalLimiter); // Bucket 1: lightweight polling
app.use('/api/procurement-alerts', globalLimiter); // Bucket 1: lightweight polling
app.use('/api/maintenance-alerts', globalLimiter); // Bucket 1: lightweight polling

// Body Parser
// Attachments are sent as base64 data URLs, which inflate the raw file size
// by ~37%. A flat 10mb JSON limit would silently reject legitimate files
// well under the documented 10MB cap. Give /api/procurement a limit sized
// for a true 10MB file (10MB * 4/3 ≈ 13.3MB, +headroom for JSON overhead),
// applied ahead of the general parser so it takes effect for this path only.
app.use('/api/procurement', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/maintenance-logs', maintenanceLogsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/procurement', procurementRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/procurement-alerts', procurementAlertsRouter);
app.use('/api/maintenance-alerts', maintenanceAlertsRouter);
app.use('/api/audit-logs', auditLogsRouter);

// Health Check
app.get('/api/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler — must be registered after all routes/middleware.
app.use(errorHandler);

// Start Server
const port = env.BACKEND_PORT || 3001;
const server = app.listen(port, () => {
  console.log(
    `[Server] Backend listening on port ${port} in ${env.NODE_ENV} mode`,
  );

  // Purge read alerts older than 24h, then scan for new stock + overdue alerts
  void (async () => {
    try {
      await AlertService.purgeOldAlerts();
      await AlertService.runFullScan();
      await MaintenanceReminderService.scanAndNotify();
      await AlertService.runOverdueScan();
    } catch (err) {
      console.warn(
        '[Alerts] Startup scan skipped — DB not ready:',
        err instanceof Error ? err.message : err,
      );
    }
  })();

  // Task 206597: daily 08:00 warranty expiry scan + digest email
  startCronJobs();

  // Re-run the overdue equipment check on a recurring schedule so items
  // crossing their due date get flagged without waiting for a manual
  // trigger or the next server restart.
  const overdueCheckInterval = setInterval(
    () => {
      void AlertService.runOverdueScan().catch((err) => {
        console.warn(
          '[Alerts] Scheduled overdue scan failed:',
          err instanceof Error ? err.message : err,
        );
      });
    },
    15 * 60 * 1000, // every 15 minutes
  );
  overdueCheckInterval.unref();
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