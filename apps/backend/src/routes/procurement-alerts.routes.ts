import { Router, Request, Response } from 'express';
import { ProcurementAlertService } from '../services/procurement-alert.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

// ── GET /procurement-alerts ───────────────────────────────────────────────────
// Returns all unread procurement alerts. Admin/Manager only.

router.get(
  '/',
  authorize('purchase_orders:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const alerts = await ProcurementAlertService.getUnreadAlerts();
      res.status(200).json(alerts);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── GET /procurement-alerts/all ───────────────────────────────────────────────
// Returns all alerts paginated. Admin/Manager only.

router.get(
  '/all',
  authorize('purchase_orders:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 30;
      const result = await ProcurementAlertService.getAllAlerts(page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /procurement-alerts/:id/read ────────────────────────────────────────
// Marks a single procurement alert as read.

router.patch(
  '/:id/read',
  authorize('purchase_orders:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid alert ID' });
        return;
      }
      const alert = await ProcurementAlertService.markAsRead(id);
      res.status(200).json(alert);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /procurement-alerts/read-all ────────────────────────────────────────
// Marks all procurement alerts as read.

router.patch(
  '/read-all',
  authorize('purchase_orders:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await ProcurementAlertService.markAllAsRead();
      res.status(200).json({ message: 'All procurement alerts marked as read' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

export default router;