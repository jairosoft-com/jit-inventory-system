import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { AlertService } from '../services/alert.service.js';

const router = Router();

router.use(authenticate);

// ── Schemas ───────────────────────────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(30),
});

const alertIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ── GET /api/alerts/unread ────────────────────────────────────────────────────
// Returns unread alerts for the current user
router.get('/unread', async (req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await AlertService.getUnreadAlerts(req.user!.id);
    res.status(200).json({ alerts, count: alerts.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// ── GET /api/alerts/count ─────────────────────────────────────────────────────
// Lightweight endpoint for the bell badge
router.get('/count', async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await AlertService.getUnreadCount(req.user!.id);
    res.status(200).json({ count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// ── GET /api/alerts ───────────────────────────────────────────────────────────
// All alerts paginated — Admin/Manager only
router.get(
  '/',
  authorize('reports:export'),
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, pageSize } = req.query as unknown as z.infer<
        typeof paginationSchema
      >;
      const result = await AlertService.getAllAlerts(page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /api/alerts/read-all ────────────────────────────────────────────────
// Mark all unread alerts as read for the current user
router.patch(
  '/read-all',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await AlertService.markAllAsRead(req.user!.id);
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
      const alert = await AlertService.markAsRead(id, req.user!.id);
      res.status(200).json({ alert });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── POST /api/alerts/scan ─────────────────────────────────────────────────────
// Trigger a full scan — Admin/Manager only
router.post(
  '/scan',
  authorize('reports:export'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await AlertService.purgeOldAlerts();
      await AlertService.runFullScan();
      await AlertService.runOverdueScan();
      res.status(200).json({ message: 'Alert scan completed successfully.' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

export default router;