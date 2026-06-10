import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Protect all dashboard routes
router.use(authenticate);

// GET /api/dashboard/summary
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await DashboardService.getSummary();
    res.status(200).json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// GET /api/dashboard/alerts
router.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const lowStock = await DashboardService.getLowStockItems();
    const warrantyExpiring = await DashboardService.getWarrantyAlerts();
    res.status(200).json({
      lowStock,
      warrantyExpiring,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// GET /api/dashboard/activity
router.get('/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const activity = await DashboardService.getRecentActivity(isNaN(limit) ? 10 : limit);
    res.status(200).json(activity);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// GET /api/dashboard/equipment-status
router.get('/equipment-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const statusBreakdown = await DashboardService.getEquipmentStatusBreakdown();
    res.status(200).json(statusBreakdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

export default router;
