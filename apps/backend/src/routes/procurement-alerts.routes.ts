import { Router, Request, Response } from 'express';
import { ProcurementAlertService } from '../services/procurement-alert.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

// ── GET /procurement-alerts ───────────────────────────────────────────────────
// Returns unread procurement alerts for the authenticated user.
// Accessible by any authenticated user (Staff, Manager, Admin).

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await ProcurementAlertService.getUnreadAlerts(req.user!.id);
    res.status(200).json(alerts);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

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

// ── GET /procurement-alerts/history ───────────────────────────────────────────
// Returns notification history for the authenticated user.
// Admin/Manager can review global procurement alert history.

router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 50;
    const alertType = req.query.alertType as
      | 'PENDING_APPROVAL'
      | 'STATUS_UPDATED'
      | undefined;
    const isAdminOrManager = [1, 2].includes(req.user!.roleId);

    const result = await ProcurementAlertService.getHistory(
      req.user!.id,
      isAdminOrManager,
      { page, pageSize, alertType },
    );

    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// ── GET /procurement-alerts/count ─────────────────────────────────────────────
// Returns unread count only — lightweight endpoint for badge polling.
// Accessible by any authenticated user.

router.get('/count', async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await ProcurementAlertService.getUnreadCount(req.user!.id);
    res.status(200).json({ count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// ── PATCH /procurement-alerts/:id/read ────────────────────────────────────────
// Marks a single procurement alert as read.

router.patch(
  '/:id/read',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid alert ID' });
        return;
      }
      const isAdminOrManager = [1, 2].includes(req.user!.roleId);
      const alert = await ProcurementAlertService.markAsRead(
        id,
        req.user!.id,
        isAdminOrManager,
      );
      res.status(200).json(alert);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /procurement-alerts/read-all ────────────────────────────────────────
// Marks all procurement alerts as read for the authenticated user.

router.patch(
  '/read-all',
  async (req: Request, res: Response): Promise<void> => {
    try {
      await ProcurementAlertService.markAllAsRead(req.user!.id);
      res
        .status(200)
        .json({ message: 'All procurement alerts marked as read' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

export default router;
