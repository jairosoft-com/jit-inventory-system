import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { AlertService } from '../services/alert.service.js';

const router = Router();

// All alert routes require auth + reports:export permission
// (Admins and Managers only, same permission gate as reports)
router.use(authenticate);
router.use(authorize('reports:export'));

// ── GET /api/alerts/unread ────────────────────────────────────────────────────
// Returns all unread, unresolved alerts (for the dropdown)
router.get('/unread', async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await AlertService.getUnreadAlerts();
    res.status(200).json({ alerts, count: alerts.length });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// ── GET /api/alerts/count ─────────────────────────────────────────────────────
// Lightweight endpoint for the bell badge
router.get('/count', async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await AlertService.getUnreadCount();
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// ── GET /api/alerts ───────────────────────────────────────────────────────────
// All alerts paginated
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page =
      typeof req.query.page === 'string'
        ? Math.max(1, Number.parseInt(req.query.page, 10))
        : 1;

    const pageSize =
      typeof req.query.pageSize === 'string'
        ? Math.min(50, Math.max(1, Number.parseInt(req.query.pageSize, 10)))
        : 30;
    const result = await AlertService.getAllAlerts(page, pageSize);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// ── PATCH /api/alerts/:id/read ────────────────────────────────────────────────
// Mark a single alert as read
router.patch(
  '/:id/read',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid alert ID' });
        return;
      }
      const alert = await AlertService.markAsRead(id);
      res.status(200).json({ alert });
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  },
);

// ── PATCH /api/alerts/read-all ────────────────────────────────────────────────
// Mark all unread alerts as read
router.patch(
  '/read-all',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await AlertService.markAllAsRead();
      res.status(200).json({ updated: result.count });
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error ? error.message : 'Internal server error',
      });
    }
  },
);

// ── POST /api/alerts/scan ─────────────────────────────────────────────────────
// Trigger a full scan of all consumable profiles (manual or scheduled)
router.post('/scan', async (_req: Request, res: Response): Promise<void> => {
  try {
    await AlertService.purgeOldAlerts();
    await AlertService.runFullScan();
    res.status(200).json({ message: 'Stock scan completed successfully.' });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
