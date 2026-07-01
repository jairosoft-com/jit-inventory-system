import {
  ConditionStatus,
  EquipmentStatus,
  BorrowStatus,
  ItemType,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { cacheGet } from '../lib/redis.js';

const WARRANTY_EXPIRY_WINDOW_DAYS = 30;
const EQUIPMENT_LIFECYCLE_YEARS = 5;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

interface DashboardAccess {
  canReadInventory: boolean;
  canReadEquipment: boolean;
  canViewLowStockDetails: boolean;
}

function startOfDay(date: Date): Date {
  return new Date(date.toLocaleDateString('sv-SE'));
}

function calculateDaysRemaining(warrantyEnd: Date, today: Date): number {
  const warrantyEndDate = startOfDay(warrantyEnd);

  return Math.ceil(
    (warrantyEndDate.getTime() - today.getTime()) / MILLISECONDS_PER_DAY,
  );
}

function addCalendarYears(date: Date, years: number): Date {
  const result = startOfDay(date);
  result.setFullYear(result.getFullYear() + years);

  return result;
}

function calculateLifecycleYears(acquisitionDate: Date, today: Date): number {
  const acquisitionStart = startOfDay(acquisitionDate);
  const todayStart = startOfDay(today);

  let completedYears =
    todayStart.getFullYear() - acquisitionStart.getFullYear();

  const anniversaryThisYear = new Date(acquisitionStart);
  anniversaryThisYear.setFullYear(todayStart.getFullYear());

  if (todayStart < anniversaryThisYear) {
    completedYears -= 1;
  }

  return Math.max(0, completedYears);
}

function hasExceededLifecycle(
  acquisitionDate: Date | null,
  today: Date,
): boolean {
  if (!acquisitionDate) {
    return false;
  }

  const replacementDate = addCalendarYears(
    acquisitionDate,
    EQUIPMENT_LIFECYCLE_YEARS,
  );

  return startOfDay(today) >= replacementDate;
}

function buildReplacementReasons(
  equipment: {
    condition: ConditionStatus;
    status: EquipmentStatus;
    acquisitionDate: Date | null;
    replacementNeeded?: boolean;
  },
  today: Date,
): string[] {
  const reasons: string[] = [];

  if (equipment.condition === ConditionStatus.DAMAGED) {
    reasons.push('Condition is damaged');
  }

  if (equipment.status === EquipmentStatus.DAMAGED) {
    reasons.push('Equipment status is damaged');
  }

  if (equipment.replacementNeeded) {
    reasons.push('Manually tagged as replacement needed');
  }

  if (equipment.status === EquipmentStatus.RETIRED) {
    reasons.push('Equipment is retired');
  }

  if (hasExceededLifecycle(equipment.acquisitionDate, today)) {
    reasons.push('Lifecycle exceeded');
  }

  return reasons;
}

function buildReplacementRecommendation(
  reasons: string[],
  lifecycleYears: number | null,
): string {
  if (
    reasons.includes('Condition is damaged') ||
    reasons.includes('Equipment status is damaged')
  ) {
    return 'Replace immediately due to damaged equipment condition or status.';
  }

  if (reasons.includes('Manually tagged as replacement needed')) {
    return 'Plan procurement for a replacement asset.';
  }

  if (reasons.includes('Equipment is retired')) {
    return 'Review and replace because the equipment is retired.';
  }

  if (reasons.includes('Lifecycle exceeded')) {
    const yearsText =
      lifecycleYears !== null
        ? `${lifecycleYears} years of use`
        : 'the expected lifecycle';

    return `Review and plan replacement because this equipment has reached ${yearsText}.`;
  }

  return 'Review equipment for possible replacement.';
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
    const { permissions } = await DashboardService.getRoleAccess(roleId);

    return permissions;
  }

  static async getRoleAccess(roleId: number): Promise<{
    roleName: string;
    permissions: string[];
  }> {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        name: true,
        rolePermissions: {
          select: {
            permission: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      return { roleName: '', permissions: [] };
    }

    return {
      roleName: role.name,
      permissions: role.rolePermissions.map(
        (rolePermission) => rolePermission.permission.name,
      ),
    };
  }

  static canViewLowStockAlertDetails(
    roleName: string,
    permissions: string[],
  ): boolean {
    const normalizedRoleName = roleName.toUpperCase();

    return (
      normalizedRoleName === 'ADMIN' ||
      normalizedRoleName === 'MANAGER' ||
      permissions.includes('inventory:manage')
    );
  }

  static async getSummary(access: DashboardAccess) {
    const [
      totalItems,
      activeEquipment,
      lowStockAlerts,
      pendingBorrows,
      totalQuantityInStock,
      availableItems,
      lowStockItems,
    ] = await Promise.all([
      access.canReadInventory
        ? prisma.item.count({
            where: { deletedAt: null, itemType: ItemType.CONSUMABLE },
          })
        : Promise.resolve(0),

      access.canReadEquipment
        ? prisma.equipment.count({
            where: {
              status: EquipmentStatus.AVAILABLE,
              deletedAt: null,
            },
          })
        : Promise.resolve(0),

      access.canViewLowStockDetails
        ? DashboardService.countLowStockItems()
        : Promise.resolve(0),

      access.canReadEquipment
        ? prisma.borrowRecord.count({
            where: {
              status: 'PENDING',
            },
          })
        : Promise.resolve(0),

      access.canReadInventory
        ? prisma.consumableProfile
            .aggregate({
              _sum: { quantity: true },
              where: { item: { deletedAt: null } },
            })
            .then((res) => res._sum.quantity || 0)
        : Promise.resolve(0),

      access.canReadInventory
        ? prisma.consumableProfile.count({
            where: {
              quantity: { gt: 0 },
              item: { deletedAt: null },
            },
          })
        : Promise.resolve(0),

      access.canReadInventory
        ? prisma.consumableProfile.count({
            where: {
              status: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] },
              item: { deletedAt: null },
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      totalItems,
      activeEquipment,
      lowStockAlerts,
      pendingBorrows,
      totalInventoryItems: totalItems,
      totalQuantityInStock,
      availableItems,
      lowStockItems,
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
          itemType: ItemType.CONSUMABLE,
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

  /**
   * Returns all borrow records that are currently OVERDUE, enriched with
   * equipment and borrower details for the dashboard alerts panel.
   * Satisfies AC: "item should appear in dashboard alerts" and
   * "overdue dashboard should be empty" when all items are within return date.
   *
   * Restricted to callers with canReadEquipment (MANAGER / ADMIN).
   */
  static async getOverdueEquipment() {
    const today = startOfDay(new Date());

    const overdueRecords = await prisma.borrowRecord.findMany({
      where: {
        OR: [
          { status: BorrowStatus.OVERDUE },
          {
            status: { in: [BorrowStatus.APPROVED, BorrowStatus.BORROWED] },
            expectedReturn: { lt: today },
          },
        ],
      },
      include: {
        equipment: {
          select: {
            assetId: true,
            item: { select: { itemName: true } },
          },
        },
        borrowedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { expectedReturn: 'asc' },
    });

    return overdueRecords.map((record) => ({
      borrowRecordId: record.id,
      assetId: record.equipment.assetId,
      itemName: record.equipment.item.itemName,
      borrowerName:
        `${record.borrowedBy.firstName} ${record.borrowedBy.lastName}`.trim(),
      expectedReturn: record.expectedReturn,
      daysOverdue: Math.floor(
        (today.getTime() - record.expectedReturn.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    }));
  }

  static async getReplacementNeededItems() {
    const today = startOfDay(new Date());
    const lifecycleCutoffDate = addCalendarYears(
      today,
      -EQUIPMENT_LIFECYCLE_YEARS,
    );

    const replacementNeeded = await prisma.equipment.findMany({
      where: {
        deletedAt: null,
        item: {
          deletedAt: null,
        },
        OR: [
          {
            replacementNeeded: true,
          },
          {
            condition: ConditionStatus.DAMAGED,
          },
          {
            status: {
              in: [EquipmentStatus.DAMAGED, EquipmentStatus.RETIRED],
            },
          },
          {
            acquisitionDate: {
              not: null,
              lte: lifecycleCutoffDate,
            },
          },
        ],
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
          updatedAt: 'desc',
        },
        {
          id: 'asc',
        },
      ],
    });

    return replacementNeeded.map((equipment) => {
      const lifecycleYears = equipment.acquisitionDate
        ? calculateLifecycleYears(equipment.acquisitionDate, today)
        : null;

      const replacementReasons = buildReplacementReasons(equipment, today);

      return {
        id: equipment.id,
        itemId: equipment.itemId,
        itemName: equipment.item.itemName,
        assetId: equipment.assetId,
        condition: equipment.condition,
        status: equipment.status,
        acquisitionDate: equipment.acquisitionDate,
        replacementNeeded: equipment.replacementNeeded,
        replacementNeededAt: equipment.replacementNeededAt,
        lifecycleYears,
        replacementRecommendation: buildReplacementRecommendation(
          replacementReasons,
          lifecycleYears,
        ),
        replacementReasons,
      };
    });
  }

  static async getRecentActivity(access: DashboardAccess, limit = 10) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const allowedTypes: string[] = [];
    if (access.canReadInventory) {
      allowedTypes.push('ConsumableProfile', 'Item');
    }
    if (access.canReadEquipment) {
      allowedTypes.push('Equipment', 'BorrowRecord');
    }

    if (allowedTypes.length === 0) {
      return [];
    }

    const logs = await prisma.inventoryLog.findMany({
      where: {
        performedAt: {
          gte: sevenDaysAgo,
        },
        entityType: {
          in: allowedTypes,
        },
      },
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

    return Promise.all(
      logs.map(async (log) => {
        let itemName = `${log.entityType} #${log.entityId}`;
        try {
          if (log.entityType === 'ConsumableProfile') {
            const profile = await prisma.consumableProfile.findUnique({
              where: { id: log.entityId },
              include: { item: { select: { itemName: true } } },
            });
            if (profile?.item) {
              itemName = profile.item.itemName;
            }
          } else if (log.entityType === 'Item') {
            const item = await prisma.item.findUnique({
              where: { id: log.entityId },
              select: { itemName: true },
            });
            if (item) {
              itemName = item.itemName;
            }
          } else if (log.entityType === 'Equipment') {
            const equipment = await prisma.equipment.findUnique({
              where: { id: log.entityId },
              include: { item: { select: { itemName: true } } },
            });
            if (equipment?.item) {
              itemName = equipment.item.itemName;
            }
          } else if (log.entityType === 'BorrowRecord') {
            const record = await prisma.borrowRecord.findUnique({
              where: { id: log.entityId },
              include: {
                equipment: {
                  include: { item: { select: { itemName: true } } },
                },
              },
            });
            if (record?.equipment?.item) {
              itemName = record.equipment.item.itemName;
            }
          }
        } catch {
          // ignore database errors, fall back to default
        }

        return {
          id: log.id,
          entityType: log.entityType,
          entityId: log.entityId,
          action: log.action,
          performedAt: log.performedAt,
          itemName,
          user: {
            firstName: log.user.firstName,
            lastName: log.user.lastName,
          },
        };
      }),
    );
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
        status: { in: ['COMPLETED', 'ARCHIVED'] },
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
      recentPurchaseActivity: recentPurchaseActivity.map((purchaseOrder) => ({
        id: purchaseOrder.id,
        invoiceNumber: purchaseOrder.invoiceNumber,
        status: purchaseOrder.status,
        totalAmount: Number(purchaseOrder.totalAmount),
        orderDate: purchaseOrder.orderDate,
        supplier: {
          name: purchaseOrder.supplier.supplierName,
        },
        createdBy: {
          firstName: purchaseOrder.createdBy.firstName,
          lastName: purchaseOrder.createdBy.lastName,
        },
        itemCount: purchaseOrder._count.lineItems,
      })),
    };
  }

  static async getInventoryDistribution() {
    const categories = await prisma.category.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            items: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return categories
      .map((c) => ({
        categoryId: c.id,
        categoryName: c.name,
        count: c._count.items,
      }))
      .filter((c) => c.count > 0);
  }

  static async getAnalytics() {
    return cacheGet('dashboard:analytics', 300, () =>
      DashboardService._getAnalyticsUncached(),
    );
  }

  private static async _getAnalyticsUncached() {
    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(endDate.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);

    const [
      stockMovementsRaw,
      conditionBreakdownRaw,
      borrowActivityRaw,
      inventoryDistribution,
    ] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          date: Date | string;
          stockIn: number;
          stockOut: number;
        }>
      >`
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

      prisma.$queryRaw<
        Array<{
          date: Date | string;
          total: number;
          active: number;
          overdue: number;
          returned: number;
        }>
      >`
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
              COUNT(CASE WHEN status IN ('APPROVED', 'BORROWED') AND expected_return >= CURRENT_DATE THEN 1 END)::int as active,
              COUNT(CASE WHEN status = 'OVERDUE' OR (status IN ('APPROVED', 'BORROWED') AND expected_return < CURRENT_DATE) THEN 1 END)::int as overdue,
              COUNT(CASE WHEN status = 'RETURNED' THEN 1 END)::int as returned
            FROM borrow_records
            WHERE created_at >= ${startDate}
            GROUP BY DATE(created_at)
          )
          SELECT 
            dates.date,
            COALESCE(borrow_agg.total, 0)::int as total,
            COALESCE(borrow_agg.active, 0)::int as active,
            COALESCE(borrow_agg.overdue, 0)::int as overdue,
            COALESCE(borrow_agg.returned, 0)::int as returned
          FROM dates
          LEFT JOIN borrow_agg ON dates.date = borrow_agg.date
          ORDER BY dates.date ASC;
        `,
      DashboardService.getInventoryDistribution(),
    ]);

    const stockMovements = stockMovementsRaw.map((movement) => ({
      date:
        movement.date instanceof Date
          ? movement.date.toISOString().split('T')[0]
          : String(movement.date),
      stockIn: Number(movement.stockIn),
      stockOut: Number(movement.stockOut),
    }));

    const allConditions: ConditionStatus[] = [
      ConditionStatus.NEW,
      ConditionStatus.GOOD,
      ConditionStatus.FAIR,
      ConditionStatus.POOR,
      ConditionStatus.DAMAGED,
    ];

    const conditionMap = new Map<ConditionStatus, number>(
      conditionBreakdownRaw.map((conditionGroup) => [
        conditionGroup.condition,
        conditionGroup._count.condition,
      ]),
    );

    const equipmentConditions = allConditions.map((condition) => ({
      condition,
      count: conditionMap.get(condition) ?? 0,
    }));

    const borrowActivity = borrowActivityRaw.map((borrow) => ({
      date:
        borrow.date instanceof Date
          ? borrow.date.toISOString().split('T')[0]
          : String(borrow.date),
      total: Number(borrow.total),
      active: Number(borrow.active),
      overdue: Number(borrow.overdue),
      returned: Number(borrow.returned),
    }));

    return {
      stockMovements,
      equipmentConditions,
      borrowActivity,
      inventoryDistribution,
    };
  }

  /**
   * Returns borrow KPI counts. When `userId` is provided the counts are
   * scoped to that single user (employee / STAFF view).
   */
  static async getBorrowSummary(userId?: number) {
    const userFilter = userId ? { borrowedById: userId } : {};
    const today = startOfDay(new Date());

    const [activeBorrows, overdueBorrows, pendingBorrows] = await Promise.all([
      prisma.borrowRecord.count({
        where: {
          status: { in: [BorrowStatus.APPROVED, BorrowStatus.BORROWED] },
          expectedReturn: { gte: today },
          ...userFilter,
        },
      }),
      prisma.borrowRecord.count({
        where: {
          OR: [
            { status: BorrowStatus.OVERDUE },
            {
              status: { in: [BorrowStatus.APPROVED, BorrowStatus.BORROWED] },
              expectedReturn: { lt: today },
            },
          ],
          ...userFilter,
        },
      }),
      prisma.borrowRecord.count({
        where: { status: BorrowStatus.PENDING, ...userFilter },
      }),
    ]);

    return { activeBorrows, overdueBorrows, pendingBorrows };
  }

  /**
   * Returns equipment ranked by total number of borrow records.
   * When `userId` is provided, only borrows by that user are counted.
   */
  static async getMostBorrowedItems(limit = 5, userId?: number) {
    const userFilter = userId ? { borrowedById: userId } : {};

    const grouped = await prisma.borrowRecord.groupBy({
      by: ['equipmentId'],
      where: { ...userFilter },
      _count: { equipmentId: true },
      orderBy: { _count: { equipmentId: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) {
      return [];
    }

    const equipmentIds = grouped.map((g) => g.equipmentId);

    const equipmentList = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
      include: {
        item: { select: { itemName: true } },
      },
    });

    const equipmentMap = new Map(equipmentList.map((eq) => [eq.id, eq]));

    return grouped
      .map((g) => {
        const equipment = equipmentMap.get(g.equipmentId);
        if (!equipment) return null;

        return {
          equipmentId: equipment.id,
          itemName: equipment.item.itemName,
          assetId: equipment.assetId,
          currentStatus: equipment.status,
          totalBorrows: g._count.equipmentId,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }
}