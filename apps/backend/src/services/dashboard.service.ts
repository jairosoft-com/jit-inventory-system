import { prisma } from '../lib/prisma.js';

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
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const warrantyExpiring = await prisma.equipment.findMany({
      where: {
        warrantyEnd: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        deletedAt: null,
      },
      include: {
        item: true,
      },
    });

    return warrantyExpiring.map((e) => ({
      id: e.id,
      itemName: e.item.itemName,
      assetId: e.assetId,
      warrantyEnd: e.warrantyEnd,
      warrantyProvider: e.warrantyProvider,
    }));
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
