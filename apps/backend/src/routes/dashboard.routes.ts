import { Router, Request, Response } from 'express';
<<<<<<< HEAD
import { DashboardService } from '../services/dashboard.service.js';
=======
import { DashboardService } from '../services/dashboard.service.js'
>>>>>>> 3d3487f (stock management module)
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

<<<<<<< HEAD
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
=======
// All dashboard routes require authentication
router.use(authenticate);

/**
 * GET /api/dashboard/stats
 * Returns KPI counters for the four stat cards:
 *   totalItems, activeEquipment, lowStockAlerts, pendingBorrows
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await DashboardService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[DashboardRoute] GET /stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Returns the latest inventory log entries for the Recent Activity feed.
 * Optional query param: ?limit=10 (default 10, max 50)
 */
router.get('/recent-activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = isNaN(rawLimit) ? 10 : Math.min(rawLimit, 50);

    const activity = await DashboardService.getRecentActivity(limit);
    res.json({ success: true, data: activity });
  } catch (error) {
    console.error('[DashboardRoute] GET /recent-activity error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent activity' });
  }
});

/**
 * GET /api/dashboard/equipment-status
 * Returns equipment counts grouped by EquipmentStatus for the
 * Equipment Status breakdown panel, plus a total.
 */
router.get('/equipment-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const breakdown = await DashboardService.getEquipmentStatusBreakdown();
    res.json({ success: true, data: breakdown });
  } catch (error) {
    console.error('[DashboardRoute] GET /equipment-status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch equipment status breakdown' });
  }
});

/**
 * GET /api/dashboard/low-stock
 * Returns consumable items where quantity <= reorderPoint.
 * Optional query param: ?limit=10 (default 10, max 50)
 */
router.get('/low-stock', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = isNaN(rawLimit) ? 10 : Math.min(rawLimit, 50);

    const items = await DashboardService.getLowStockItems(limit);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('[DashboardRoute] GET /low-stock error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch low stock items' });
  }
});

export default router;
>>>>>>> 3d3487f (stock management module)
