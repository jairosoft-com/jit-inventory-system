import { prisma } from '../lib/prisma.js';

const WARRANTY_EXPIRY_WINDOW_DAYS = 30;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

interface DashboardAccess {
  canReadInventory: boolean;
  canReadEquipment: boolean;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculateDaysRemaining(warrantyEnd: Date, today: Date): number {
  const warrantyEndDate = startOfDay(warrantyEnd);

  return Math.ceil(
    (warrantyEndDate.getTime() - today.getTime()) / MILLISECONDS_PER_DAY,
  );
}

function isLowStock(quantity: number, reorderPoint: number): boolean {
  return quantity <= reorderPoint;
}

function getDisplayStockStatus(
  quantity: number,
  reorderPoint: number,
  currentStatus: string,
): string {
  if (quantity <= 0) {
    return 'OUT_OF_STOCK';
  }

  if (quantity <= reorderPoint) {
    return 'LOW_STOCK';
  }

  return currentStatus;
}

export class DashboardService {
  static async getRolePermissionNames(roleId: number): Promise<string[]> {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      select: {
        permission: {
          select: {
            name: true,
          },
        },
      },
    });

    return rolePermissions.map((rp) => rp.permission.name);
  }

  static async getSummary(access: DashboardAccess) {
    const [totalItems, activeEquipment, lowStockAlerts, pendingBorrows] =
      await Promise.all([
        access.canReadInventory
          ? prisma.item.count({
              where: { deletedAt: null },
            })
          : Promise.resolve(0),

        access.canReadEquipment
          ? prisma.equipment.count({
              where: {
                status: 'AVAILABLE',
                deletedAt: null,
              },
            })
          : Promise.resolve(0),

        access.canReadInventory
          ? DashboardService.countLowStockItems()
          : Promise.resolve(0),

        access.canReadEquipment
          ? prisma.borrowRecord.count({
              where: {
                status: 'PENDING',
              },
            })
          : Promise.resolve(0),
      ]);

    return {
      totalItems,
      activeEquipment,
      lowStockAlerts,
      pendingBorrows,
    };
  }

  private static async getLowStockProfiles() {
    const consumableProfiles = await prisma.consumableProfile.findMany({
      where: {
        status: {
          not: 'ARCHIVED',
        },
        item: {
          deletedAt: null,
        },
      },
      include: {
        item: {
          select: {
            itemName: true,
          },
        },
      },
      orderBy: [
        {
          quantity: 'asc',
        },
        {
          reorderPoint: 'desc',
        },
        {
          id: 'asc',
        },
      ],
    });

    return consumableProfiles.filter((profile) =>
      isLowStock(profile.quantity, profile.reorderPoint),
    );
  }

  private static async countLowStockItems(): Promise<number> {
    const lowStockProfiles = await DashboardService.getLowStockProfiles();

    return lowStockProfiles.length;
  }

  static async getLowStockItems() {
    const lowStock = await DashboardService.getLowStockProfiles();

    return lowStock.map((profile) => ({
      id: profile.id,
      itemId: profile.itemId,
      itemName: profile.item.itemName,
      quantity: profile.quantity,
      reorderPoint: profile.reorderPoint,
      unit: profile.unit,
      status: getDisplayStockStatus(
        profile.quantity,
        profile.reorderPoint,
        profile.status,
      ),
    }));
  }

  static async getWarrantyAlerts() {
    const today = startOfDay(new Date());
    const warrantyWindowEnd = new Date(today);
    warrantyWindowEnd.setDate(today.getDate() + WARRANTY_EXPIRY_WINDOW_DAYS);

    const warrantyExpiring = await prisma.equipment.findMany({
      where: {
        warrantyEnd: {
          not: null,
          gte: today,
          lte: warrantyWindowEnd,
        },
        deletedAt: null,
        item: {
          deletedAt: null,
        },
      },
      include: {
        item: true,
      },
      orderBy: {
        warrantyEnd: 'asc',
      },
    });

    return warrantyExpiring.map((equipment) => {
      const warrantyEnd = equipment.warrantyEnd!;
      const daysRemaining = calculateDaysRemaining(warrantyEnd, today);

      return {
        id: equipment.id,
        itemName: equipment.item.itemName,
        assetId: equipment.assetId,
        warrantyEnd,
        warrantyProvider: equipment.warrantyProvider,
        daysRemaining,
      };
    });
  }

  static async getRecentActivity(limit = 10) {
    const logs = await prisma.inventoryLog.findMany({
      orderBy: {
        performedAt: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      performedAt: log.performedAt,
      user: {
        firstName: log.user.firstName,
        lastName: log.user.lastName,
      },
    }));
  }

  static async getEquipmentStatusBreakdown() {
    const breakdown = await prisma.equipment.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
      },
      _count: {
        status: true,
      },
    });

    return breakdown.map((group) => ({
      status: group.status,
      count: group._count.status,
    }));
  }

  static async getProcurementSummary() {
    const pendingOrders = await prisma.purchaseOrder.count({
      where: {
        status: { in: ['DRAFT', 'PENDING'] },
      },
    });

    const completedOrders = await prisma.purchaseOrder.count({
      where: {
        status: 'RECEIVED',
      },
    });

    const recentPurchaseActivity = await prisma.purchaseOrder.findMany({
      orderBy: {
        orderDate: 'desc',
      },
      take: 5,
      include: {
        supplier: {
          select: {
            supplierName: true,
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            lineItems: true,
          },
        },
      },
    });

    return {
      pendingOrders,
      completedOrders,
      recentPurchaseActivity: recentPurchaseActivity.map((po) => ({
        id: po.id,
        invoiceNumber: po.invoiceNumber,
        status: po.status,
        totalAmount: Number(po.totalAmount),
        orderDate: po.orderDate,
        supplier: {
          name: po.supplier.supplierName,
        },
        createdBy: {
          firstName: po.createdBy.firstName,
          lastName: po.createdBy.lastName,
        },
        itemCount: po._count.lineItems,
      })),
    };
  }

  static async getAnalytics() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);

    const [stockMovementsRaw, conditionBreakdownRaw, borrowActivityRaw] = await Promise.all([
      prisma.$queryRaw<Array<{
        date: Date | string;
        stockIn: number;
        stockOut: number;
      }>>`
        WITH dates AS (
          SELECT generate_series(
            ${startDate}::date,
            ${endDate}::date,
            '1 day'::interval
          )::date AS date
        ),
        in_agg AS (
          SELECT DATE(created_at) as date, SUM(quantity_added)::int as stock_in
          FROM stock_in
          WHERE created_at >= ${startDate}
          GROUP BY DATE(created_at)
        ),
        out_agg AS (
          SELECT DATE(created_at) as date, SUM(quantity_removed)::int as stock_out
          FROM stock_out
          WHERE created_at >= ${startDate}
          GROUP BY DATE(created_at)
        )
        SELECT 
          dates.date,
          COALESCE(in_agg.stock_in, 0)::int as "stockIn",
          COALESCE(out_agg.stock_out, 0)::int as "stockOut"
        FROM dates
        LEFT JOIN in_agg ON dates.date = in_agg.date
        LEFT JOIN out_agg ON dates.date = out_agg.date
        ORDER BY dates.date ASC;
      `,

      prisma.equipment.groupBy({
        by: ['condition'],
        where: {
          deletedAt: null,
        },
        _count: {
          condition: true,
        },
      }),

      prisma.$queryRaw<Array<{
        date: Date | string;
        total: number;
        pending: number;
        approved: number;
        returned: number;
      }>>`
        WITH dates AS (
          SELECT generate_series(
            ${startDate}::date,
            ${endDate}::date,
            '1 day'::interval
          )::date AS date
        ),
        borrow_agg AS (
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::int as total,
            COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int as pending,
            COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::int as approved,
            COUNT(CASE WHEN status = 'RETURNED' THEN 1 END)::int as returned
          FROM borrow_records
          WHERE created_at >= ${startDate}
          GROUP BY DATE(created_at)
        )
        SELECT 
          dates.date,
          COALESCE(borrow_agg.total, 0)::int as total,
          COALESCE(borrow_agg.pending, 0)::int as pending,
          COALESCE(borrow_agg.approved, 0)::int as approved,
          COALESCE(borrow_agg.returned, 0)::int as returned
        FROM dates
        LEFT JOIN borrow_agg ON dates.date = borrow_agg.date
        ORDER BY dates.date ASC;
      `
    ]);

    // Format stock movements
    const stockMovements = stockMovementsRaw.map((m) => ({
      date: m.date instanceof Date ? m.date.toISOString().split('T')[0] : String(m.date),
      stockIn: Number(m.stockIn),
      stockOut: Number(m.stockOut),
    }));

    // Format equipment conditions ensuring all ConditionStatus enums are represented
    const allConditions = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
    const conditionMap = new Map(conditionBreakdownRaw.map((c) => [c.condition, c._count.condition]));
    const equipmentConditions = allConditions.map((cond) => ({
      condition: cond,
      count: conditionMap.get(cond as any) || 0,
    }));

    // Format borrow activity
    const borrowActivity = borrowActivityRaw.map((b) => ({
      date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date),
      total: Number(b.total),
      pending: Number(b.pending),
      approved: Number(b.approved),
      returned: Number(b.returned),
    }));

    return {
      stockMovements,
      equipmentConditions,
      borrowActivity,
    };
  }
}

