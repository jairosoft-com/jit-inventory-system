import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { AlertService } from '../services/alert.service.js';

const router = Router();

router.use(authenticate);

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
      'BORROW_RETURNED',
    ])
    .optional(),
});

const alertIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ── GET /api/alerts/unread ────────────────────────────────────────────────────
router.get('/unread', async (req: Request, res: Response): Promise<void> => {
  try {
    const isAdminOrManager = [1, 2].includes(req.user!.roleId);
    const alerts = await AlertService.getUnreadAlerts(
      req.user!.id,
      isAdminOrManager,
    );
    res.status(200).json({ alerts, count: alerts.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// ── GET /api/alerts/count ─────────────────────────────────────────────────────
router.get('/count', async (req: Request, res: Response): Promise<void> => {
  try {
    const isAdminOrManager = [1, 2].includes(req.user!.roleId);
    const count = await AlertService.getUnreadCount(
      req.user!.id,
      isAdminOrManager,
    );
    res.status(200).json({ count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// ── GET /api/alerts ───────────────────────────────────────────────────────────
router.get(
  '/',
  authorize('reports:export'),
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
router.patch(
  '/read-all',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const isAdminOrManager = [1, 2].includes(req.user!.roleId);
      const result = await AlertService.markAllAsRead(
        req.user!.id,
        isAdminOrManager,
      );
      res.status(200).json({ updated: result.count });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /api/alerts/:id/read ────────────────────────────────────────────────
router.patch(
  '/:id/read',
  validate(alertIdSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof alertIdSchema>;
      const isAdminOrManager = [1, 2].includes(req.user!.roleId);
      const alert = await AlertService.markAsRead(
        id,
        req.user!.id,
        isAdminOrManager,
      );
      res.status(200).json({ alert });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      if (message.includes('Forbidden')) {
        res.status(403).json({ message });
        return;
      }
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

// ── POST /api/alerts/scan ─────────────────────────────────────────────────────
router.post(
  '/scan',
  authorize('reports:export'),
  async (_req: Request, res: Response): Promise<void> => {
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
  },
);

export default router;
