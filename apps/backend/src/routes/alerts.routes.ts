import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { AlertService } from '../services/alert.service.js';

const router = Router();

// All alert routes require auth + reports:export permission
// (Admins and Managers only, same permission gate as reports)
router.use(authenticate);
router.use(authorize('reports:export'));

// ── Schemas ───────────────────────────────────────────────────────────────────

const alertHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(30),
  alertType: z
    .enum([
      'LOW_STOCK',
      'OUT_OF_STOCK',
      'WARRANTY_EXPIRING',
      'REPLACEMENT_NEEDED',
      'OVERDUE_EQUIPMENT',
    ])
    .optional(),
});

const alertIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ── GET /api/alerts/unread ────────────────────────────────────────────────────
// Returns all unread, unresolved alerts (for the dropdown)
router.get('/unread', async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await AlertService.getUnreadAlerts();
    res.status(200).json({ alerts, count: alerts.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// ── GET /api/alerts/count ─────────────────────────────────────────────────────
// Lightweight endpoint for the bell badge
router.get('/count', async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await AlertService.getUnreadCount();
    res.status(200).json({ count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// ── GET /api/alerts ───────────────────────────────────────────────────────────
// All alerts paginated
router.get(
  '/',
  validate(alertHistoryQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as unknown as z.infer<
        typeof alertHistoryQuerySchema
      >;
      const result = await AlertService.getAllAlerts(query);
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /api/alerts/read-all ────────────────────────────────────────────────
// Mark all unread alerts as read
// NOTE: must be registered before /:id/read to avoid route conflict
router.patch(
  '/read-all',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await AlertService.markAllAsRead();
      res.status(200).json({ updated: result.count });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /api/alerts/:id/read ────────────────────────────────────────────────
// Mark a single alert as read
router.patch(
  '/:id/read',
  validate(alertIdSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof alertIdSchema>;
      const alert = await AlertService.markAsRead(id);
      res.status(200).json({ alert });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── POST /api/alerts/scan ─────────────────────────────────────────────────────
// Trigger a full scan: stock, warranty, and overdue equipment alerts
router.post('/scan', async (_req: Request, res: Response): Promise<void> => {
  try {
    await AlertService.purgeOldAlerts();
    await AlertService.runFullScan();
    await AlertService.runWarrantyScan();
    await AlertService.runOverdueScan();
    res.status(200).json({ message: 'Alert scan completed successfully.' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

export default router;
