import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

const DASHBOARD_OVERVIEW_PERMISSIONS = ['inventory:read', 'equipment:read'];

router.use(authenticate);

// GET /api/dashboard/summary
router.get(
  '/summary',
  authorize(...DASHBOARD_OVERVIEW_PERMISSIONS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const summary = await DashboardService.getSummary();
      res.status(200).json(summary);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /api/dashboard/alerts
router.get(
  '/alerts',
  authorize(...DASHBOARD_OVERVIEW_PERMISSIONS),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const lowStock = await DashboardService.getLowStockItems();
      const warrantyExpiring = await DashboardService.getWarrantyAlerts();

      res.status(200).json({
        lowStock,
        warrantyExpiring,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /api/dashboard/warranty-alerts
router.get(
  '/warranty-alerts',
  authorize('equipment:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const warrantyExpiring = await DashboardService.getWarrantyAlerts();
      res.status(200).json(warrantyExpiring);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /api/dashboard/activity
router.get(
  '/activity',
  authorize('inventory:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 10;

      const activity = await DashboardService.getRecentActivity(
        isNaN(limit) ? 10 : limit,
      );

      res.status(200).json(activity);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /api/dashboard/equipment-status
router.get(
  '/equipment-status',
  authorize('equipment:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const statusBreakdown =
        await DashboardService.getEquipmentStatusBreakdown();
      res.status(200).json(statusBreakdown);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /api/dashboard/procurement-summary
router.get('/procurement-summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const procurementSummary = await DashboardService.getProcurementSummary();
    res.status(200).json(procurementSummary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// GET /api/dashboard/analytics
router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const analytics = await DashboardService.getAnalytics();
    res.status(200).json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

export default router;