import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

interface DashboardAccess {
  canReadInventory: boolean;
  canReadEquipment: boolean;
}

class DashboardRouteError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

router.use(authenticate);

async function getDashboardAccess(req: Request): Promise<DashboardAccess> {
  const roleId = req.user?.roleId;

  if (!roleId) {
    throw new DashboardRouteError('Forbidden: Insufficient permissions', 403);
  }

  const permissions = await DashboardService.getRolePermissionNames(roleId);

  const canReadInventory = permissions.includes('inventory:read');
  const canReadEquipment = permissions.includes('equipment:read');

  if (!canReadInventory && !canReadEquipment) {
    throw new DashboardRouteError('Forbidden: Insufficient permissions', 403);
  }

  return {
    canReadInventory,
    canReadEquipment,
  };
}

function sendDashboardError(res: Response, error: unknown): void {
  if (error instanceof DashboardRouteError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  const message =
    error instanceof Error ? error.message : 'Internal server error';

  res.status(500).json({ message });
}

// GET /api/dashboard/all
router.get('/all', async (req: Request, res: Response): Promise<void> => {
  try {
    const roleId = req.user?.roleId;
    if (!roleId) {
      res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
      return;
    }

    const permissions = await DashboardService.getRolePermissionNames(roleId);
    const canReadInventory = permissions.includes('inventory:read');
    const canReadEquipment = permissions.includes('equipment:read');

    if (!canReadInventory && !canReadEquipment) {
      res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
      return;
    }

    const access = { canReadInventory, canReadEquipment };
    const includeAnalytics =
      req.query.analytics === 'true' && permissions.includes('reports:export');

    const [
      summary,
      lowStock,
      warrantyExpiring,
      activity,
      equipmentStatus,
      procurementSummary,
      analytics,
    ] = await Promise.all([
      DashboardService.getSummary(access),

      canReadInventory
        ? DashboardService.getLowStockItems()
        : Promise.resolve([]),

      canReadEquipment
        ? DashboardService.getWarrantyAlerts()
        : Promise.resolve([]),

      canReadInventory || canReadEquipment
        ? DashboardService.getRecentActivity(access, 10)
        : Promise.resolve([]),

      canReadEquipment
        ? DashboardService.getEquipmentStatusBreakdown()
        : Promise.resolve([]),

      DashboardService.getProcurementSummary(),

      includeAnalytics
        ? DashboardService.getAnalytics()
        : Promise.resolve(null),
    ]);

    res.status(200).json({
      summary,
      alerts: {
        lowStock,
        warrantyExpiring,
      },
      recentActivity: activity,
      equipmentBreakdown: equipmentStatus,
      procurementSummary,
      analytics,
    });
  } catch (error) {
    sendDashboardError(res, error);
  }
});

// GET /api/dashboard/summary
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const access = await getDashboardAccess(req);
    const summary = await DashboardService.getSummary(access);

    res.status(200).json(summary);
  } catch (error) {
    sendDashboardError(res, error);
  }
});

// GET /api/dashboard/alerts
router.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const access = await getDashboardAccess(req);

    const [lowStock, warrantyExpiring] = await Promise.all([
      access.canReadInventory
        ? DashboardService.getLowStockItems()
        : Promise.resolve([]),
      access.canReadEquipment
        ? DashboardService.getWarrantyAlerts()
        : Promise.resolve([]),
    ]);

    res.status(200).json({
      lowStock,
      warrantyExpiring,
    });
  } catch (error) {
    sendDashboardError(res, error);
  }
});

// GET /api/dashboard/warranty-alerts
router.get(
  '/warranty-alerts',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const access = await getDashboardAccess(req);

      if (!access.canReadEquipment) {
        res.status(200).json([]);
        return;
      }

      const warrantyExpiring = await DashboardService.getWarrantyAlerts();

      res.status(200).json(warrantyExpiring);
    } catch (error) {
      sendDashboardError(res, error);
    }
  },
);

// GET /api/dashboard/activity
router.get('/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const access = await getDashboardAccess(req);

    if (!access.canReadInventory && !access.canReadEquipment) {
      res.status(200).json([]);
      return;
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;

    const activity = await DashboardService.getRecentActivity(
      access,
      isNaN(limit) ? 10 : limit,
    );

    res.status(200).json(activity);
  } catch (error) {
    sendDashboardError(res, error);
  }
});

// GET /api/dashboard/equipment-status
router.get(
  '/equipment-status',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const access = await getDashboardAccess(req);

      if (!access.canReadEquipment) {
        res.status(200).json([]);
        return;
      }

      const statusBreakdown =
        await DashboardService.getEquipmentStatusBreakdown();

      res.status(200).json(statusBreakdown);
    } catch (error) {
      sendDashboardError(res, error);
    }
  },
);

// GET /api/dashboard/procurement-summary
router.get(
  '/procurement-summary',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const procurementSummary = await DashboardService.getProcurementSummary();
      res.status(200).json(procurementSummary);
    } catch (error) {
      sendDashboardError(res, error);
    }
  },
);

// GET /api/dashboard/analytics
router.get(
  '/analytics',
  authorize('reports:export'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const analytics = await DashboardService.getAnalytics();
      res.status(200).json(analytics);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

export default router;
