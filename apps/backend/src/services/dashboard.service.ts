import { prisma } from '../lib/prisma.js';
import { ItemStatus, EquipmentStatus, BorrowStatus } from '@prisma/client';

export class DashboardService {
  // ── KPI Stats ──────────────────────────────────────────────────────────────

  static async getStats() {
    const [
      totalItems,
      activeEquipment,
      lowStockAlerts,
      pendingBorrows,
    ] = await Promise.all([
      // Total non-archived items
      prisma.item.count({
        where: { deletedAt: null },
      }),

      // Active equipment: AVAILABLE + IN_USE + BORROWED
      prisma.equipment.count({
        where: {
          item: { deletedAt: null },
          status: {
            in: [
              EquipmentStatus.AVAILABLE,
              EquipmentStatus.IN_USE,
              EquipmentStatus.BORROWED,
            ],
          },
        },
      }),

      // Low stock: consumable profiles where quantity <= reorderPoint (and > 0 for LOW_STOCK)
      prisma.consumableProfile.count({
        where: {
          item: { deletedAt: null },
          OR: [
            // LOW_STOCK: quantity > 0 but at or below reorder point
            {
              quantity: { gt: 0 },
              reorderPoint: { gt: 0 },
              // Prisma doesn't support column comparisons directly; use raw for accuracy
              // Fallback: items where status = LOW_STOCK or OUT_OF_STOCK
            },
            {
              quantity: { lte: 0 },
            },
          ],
        },
      }),

      // Pending borrow requests
      prisma.borrowRecord.count({
        where: { status: BorrowStatus.PENDING },
      }),
    ]);

    // Use a more accurate raw query for low stock (quantity <= reorderPoint)
    const lowStockCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM consumable_profiles cp
      INNER JOIN items i ON i.id = cp.item_id
      WHERE i.deleted_at IS NULL
        AND (cp.quantity <= cp.reorder_point OR cp.quantity <= 0)
    `;

    return {
      totalItems,
      activeEquipment,
      lowStockAlerts: Number(lowStockCount[0].count),
      pendingBorrows,
    };
  }

  // ── Recent Activity ────────────────────────────────────────────────────────

  static async getRecentActivity(limit = 10) {
    const logs = await prisma.inventoryLog.findMany({
      orderBy: { performedAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      performedBy: {
        id: log.user.id,
        name: `${log.user.firstName} ${log.user.lastName}`,
      },
      performedAt: log.performedAt,
      // Surface a human-readable label
      description: buildActivityDescription(log.action, log.entityType, log.entityId),
    }));
  }

  // ── Equipment Status Breakdown ─────────────────────────────────────────────

  static async getEquipmentStatusBreakdown() {
    const counts = await prisma.equipment.groupBy({
      by: ['status'],
      where: { item: { deletedAt: null } },
      _count: { _all: true },
    });

    // Ensure all statuses are represented (even if count is 0)
    const allStatuses = Object.values(EquipmentStatus);
    const statusMap = new Map(
      counts.map((c) => [c.status, c._count._all]),
    );

    const total = counts.reduce((sum, c) => sum + c._count._all, 0);

    return {
      total,
      breakdown: allStatuses.map((status) => ({
        status,
        count: statusMap.get(status) ?? 0,
        percentage: total > 0
          ? Math.round(((statusMap.get(status) ?? 0) / total) * 100)
          : 0,
      })),
    };
  }

  // ── Low Stock Items ────────────────────────────────────────────────────────

  static async getLowStockItems(limit = 10) {
    // Items where quantity is at or below reorderPoint
    const profiles = await prisma.$queryRaw<
      Array<{
        item_id: number;
        item_name: string;
        quantity: number;
        reorder_point: number;
        unit: string;
        category_name: string;
      }>
    >`
      SELECT
        i.id          AS item_id,
        i.item_name,
        cp.quantity,
        cp.reorder_point,
        cp.unit,
        c.name        AS category_name
      FROM consumable_profiles cp
      INNER JOIN items i     ON i.id  = cp.item_id
      INNER JOIN categories c ON c.id = i.category_id
      WHERE i.deleted_at IS NULL
        AND (cp.quantity <= cp.reorder_point OR cp.quantity <= 0)
      ORDER BY cp.quantity ASC
      LIMIT ${limit}
    `;

    return profiles.map((p) => ({
      itemId: p.item_id,
      itemName: p.item_name,
      quantity: p.quantity,
      reorderPoint: p.reorder_point,
      unit: p.unit,
      category: p.category_name,
      status: p.quantity <= 0 ? ItemStatus.OUT_OF_STOCK : ItemStatus.LOW_STOCK,
    }));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildActivityDescription(
  action: string,
  entityType: string,
  entityId: number,
): string {
  const entity = formatEntityType(entityType);
  switch (action) {
    case 'CREATED':   return `New ${entity} registered (#${entityId})`;
    case 'UPDATED':   return `${entity} #${entityId} was updated`;
    case 'DELETED':   return `${entity} #${entityId} was removed`;
    case 'APPROVED':  return `${entity} #${entityId} approved`;
    case 'REJECTED':  return `${entity} #${entityId} rejected`;
    case 'BORROWED':  return `${entity} #${entityId} borrowed`;
    case 'RETURNED':  return `${entity} #${entityId} returned`;
    case 'DISPOSED':  return `${entity} #${entityId} disposed`;
    default:          return `${entity} #${entityId} — ${action}`;
  }
}

function formatEntityType(entityType: string): string {
  return entityType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}