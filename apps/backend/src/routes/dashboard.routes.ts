import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

interface DashboardAccess {
  canReadInventory: boolean;
  canReadEquipment: boolean;
  canViewLowStockDetails: boolean;
  permissions: string[];
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

  const roleAccess = await DashboardService.getRoleAccess(roleId);
  const roleName = roleAccess.roleName;
  const permissions = roleAccess.permissions;

  const canReadInventory =
    permissions.includes('inventory:read') ||
    permissions.includes('inventory:manage');

  const canReadEquipment =
    permissions.includes('equipment:read') ||
    permissions.includes('equipment:manage');

  if (!canReadInventory && !canReadEquipment) {
    throw new DashboardRouteError('Forbidden: Insufficient permissions', 403);
  }

  return {
    canReadInventory,
    canReadEquipment,
    canViewLowStockDetails: DashboardService.canViewLowStockAlertDetails(
      roleName,
      permissions,
    ),
    permissions,
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
    const access = await getDashboardAccess(req);

    const includeAnalytics =
      req.query.analytics === 'true' &&
      access.permissions.includes('reports:export');

    // Staff users only see their own borrow data unless they can approve borrows.
    const canApproveBorrows = access.permissions.includes('borrow:approve');
    const borrowUserId = canApproveBorrows ? undefined : req.user?.id;

    const [
      summary,
      lowStock,
      warrantyExpiring,
      overdueEquipment,
      activity,
      equipmentStatus,
      procurementSummary,
      analytics,
      borrowSummary,
      mostBorrowed,
      replacementNeeded,
    ] = await Promise.all([
      DashboardService.getSummary(access),

      access.canViewLowStockDetails
        ? DashboardService.getLowStockItems()
        : Promise.resolve([]),

      access.canReadEquipment
        ? DashboardService.getWarrantyAlerts()
        : Promise.resolve([]),

      access.canReadEquipment
        ? DashboardService.getOverdueEquipment()
        : Promise.resolve([]),

      access.canReadInventory || access.canReadEquipment
        ? DashboardService.getRecentActivity(access, 10)
        : Promise.resolve([]),

      access.canReadEquipment
        ? DashboardService.getEquipmentStatusBreakdown()
        : Promise.resolve([]),

      DashboardService.getProcurementSummary(),

      includeAnalytics
        ? DashboardService.getAnalytics()
        : Promise.resolve(null),

      DashboardService.getBorrowSummary(borrowUserId),

      DashboardService.getMostBorrowedItems(5, borrowUserId),

      access.canReadEquipment
        ? DashboardService.getReplacementNeededItems()
        : Promise.resolve([]),
    ]);

    res.status(200).json({
      summary,
      alerts: {
        lowStock,
        warrantyExpiring,
        overdueEquipment,
      },
      recentActivity: activity,
      equipmentBreakdown: equipmentStatus,
      replacementNeeded,
      procurementSummary,
      analytics,
      borrowSummary,
      mostBorrowed,
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

    const [lowStock, warrantyExpiring, overdueEquipment] = await Promise.all([
      access.canViewLowStockDetails
        ? DashboardService.getLowStockItems()
        : Promise.resolve([]),

      access.canReadEquipment
        ? DashboardService.getWarrantyAlerts()
        : Promise.resolve([]),

      access.canReadEquipment
        ? DashboardService.getOverdueEquipment()
        : Promise.resolve([]),
    ]);

    res.status(200).json({
      lowStock,
      warrantyExpiring,
      overdueEquipment,
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

// GET /api/dashboard/overdue-equipment
// Returns the list of currently-overdue borrow records for the dashboard
// overdue card. Restricted to MANAGER / ADMIN (canReadEquipment).
router.get(
  '/overdue-equipment',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const access = await getDashboardAccess(req);

      if (!access.canReadEquipment) {
        res.status(200).json([]);
        return;
      }

      const overdueEquipment = await DashboardService.getOverdueEquipment();

      res.status(200).json(overdueEquipment);
    } catch (error) {
      sendDashboardError(res, error);
    }
  },
);

// GET /api/dashboard/replacement-needed
router.get(
  '/replacement-needed',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const access = await getDashboardAccess(req);

      if (!access.canReadEquipment) {
        res.status(200).json([]);
        return;
      }

      const replacementNeeded =
        await DashboardService.getReplacementNeededItems();

      res.status(200).json(replacementNeeded);
    } catch (error) {
      sendDashboardError(res, error);
    }
  },
);

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
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const procurementSummary = await DashboardService.getProcurementSummary();

      res.status(200).json(procurementSummary);
    } catch (error) {
      sendDashboardError(res, error);
    }
  },
);

// GET /api/dashboard/borrow-summary
router.get(
  '/borrow-summary',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const access = await getDashboardAccess(req);

      if (!access.canReadEquipment) {
        res
          .status(200)
          .json({ activeBorrows: 0, overdueBorrows: 0, pendingBorrows: 0 });
        return;
      }

      // Staff users only see their own borrow data unless they can approve borrows.
      const canApproveBorrows = access.permissions.includes('borrow:approve');
      const borrowUserId = canApproveBorrows ? undefined : req.user?.id;

      const borrowSummary =
        await DashboardService.getBorrowSummary(borrowUserId);

      res.status(200).json(borrowSummary);
    } catch (error) {
      sendDashboardError(res, error);
    }
  },
);

// GET /api/dashboard/most-borrowed
router.get(
  '/most-borrowed',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const access = await getDashboardAccess(req);

      if (!access.canReadEquipment) {
        res.status(200).json([]);
        return;
      }

      // Staff users only see their own most-borrowed items unless they can approve borrows.
      const canApproveBorrows = access.permissions.includes('borrow:approve');
      const borrowUserId = canApproveBorrows ? undefined : req.user?.id;

      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 5;

      const mostBorrowed = await DashboardService.getMostBorrowedItems(
        isNaN(limit) ? 5 : limit,
        borrowUserId,
      );

      res.status(200).json(mostBorrowed);
    } catch (error) {
      sendDashboardError(res, error);
    }
  },
);

// GET /api/dashboard/analytics
router.get(
  '/analytics',
  authorize('reports:export'),
  async (_req: Request, res: Response): Promise<void> => {
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