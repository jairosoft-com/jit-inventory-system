import { prisma } from '../lib/prisma.js';

const WARRANTY_EXPIRY_WINDOW_DAYS = 30;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculateDaysRemaining(warrantyEnd: Date, today: Date): number {
  const warrantyEndDate = startOfDay(warrantyEnd);

  return Math.ceil(
    (warrantyEndDate.getTime() - today.getTime()) / MILLISECONDS_PER_DAY,
  );
}

export class DashboardService {
  static async getSummary() {
    const totalItems = await prisma.item.count({
      where: { deletedAt: null },
    });

    const activeEquipment = await prisma.equipment.count({
      where: {
        status: 'AVAILABLE',
        deletedAt: null,
      },
    });

    const lowStockAlerts = await prisma.consumableProfile.count({
      where: {
        status: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] },
        item: { deletedAt: null },
      },
    });

    const pendingBorrows = await prisma.borrowRecord.count({
      where: {
        status: 'PENDING',
      },
    });

    return {
      totalItems,
      activeEquipment,
      lowStockAlerts,
      pendingBorrows,
    };
  }

  static async getLowStockItems() {
    const lowStock = await prisma.consumableProfile.findMany({
      where: {
        status: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] },
        item: { deletedAt: null },
      },
      include: {
        item: true,
      },
    });

    return lowStock.map((p) => ({
      id: p.id,
      itemId: p.itemId,
      itemName: p.item.itemName,
      quantity: p.quantity,
      reorderPoint: p.reorderPoint,
      unit: p.unit,
      status: p.status,
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