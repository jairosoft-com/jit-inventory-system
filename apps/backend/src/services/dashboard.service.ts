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
}
