import { PrismaClient, BorrowStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BorrowService } from './borrow.service.js';

// Typed alias ensures ESLint's type-checker resolves all Prisma model methods
const db: PrismaClient = prisma;

// How long to suppress duplicate alerts for the same item (24 hours)
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export class AlertService {
  /**
   * Called after any stock change. Checks the consumable profile
   * and creates a low stock / out of stock alert if needed.
   * Deduplicates: skips if an unresolved alert of the same type
   * was already created within the cooldown window.
   */
  static async checkAndCreateStockAlert(
    consumableProfileId: number,
  ): Promise<void> {
    const profile = await db.consumableProfile.findUnique({
      where: { id: consumableProfileId },
      include: {
        item: { select: { itemName: true } },
      },
    });

    if (!profile || profile.status === 'ARCHIVED') return;

    // Determine alert type and message based on current status
    let alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | null = null;
    let priority: 'WARNING' | 'CRITICAL' = 'WARNING';
    let message = '';

    if (profile.status === 'OUT_OF_STOCK') {
      alertType = 'OUT_OF_STOCK';
      priority = 'CRITICAL';
      message = `"${profile.item.itemName}" is out of stock (current quantity: 0 ${profile.unit}). Immediate restocking required.`;
    } else if (profile.status === 'LOW_STOCK') {
      alertType = 'LOW_STOCK';
      priority = 'WARNING';
      message = `"${profile.item.itemName}" is running low (${profile.quantity} ${profile.unit} remaining, reorder point: ${profile.reorderPoint} ${profile.unit}).`;
    }

    // Stock is healthy — resolve and mark-read any open alerts for this item
    if (!alertType) {
      await db.inventoryAlert.updateMany({
        where: {
          consumableProfileId,
          resolvedAt: null,
        },
        data: { resolvedAt: new Date(), isRead: true, readAt: new Date() },
      });
      return;
    }

    // Deduplication: check if an unresolved alert of this type already exists
    // within the cooldown window
    const cooldownFrom = new Date(Date.now() - ALERT_COOLDOWN_MS);
    const existing = await db.inventoryAlert.findFirst({
      where: {
        consumableProfileId,
        alertType,
        resolvedAt: null,
        createdAt: { gte: cooldownFrom },
      },
    });

    if (existing) {
      // Duplicate within cooldown period — skip
      return;
    }

    // Resolve and mark-read any old open alerts of a different type for this item
    // e.g. upgrading from LOW_STOCK to OUT_OF_STOCK
    await db.inventoryAlert.updateMany({
      where: {
        consumableProfileId,
        alertType: { not: alertType },
        resolvedAt: null,
      },
      data: { resolvedAt: new Date(), isRead: true, readAt: new Date() },
    });

    // Create the new alert
    await db.inventoryAlert.create({
      data: {
        consumableProfileId,
        alertType,
        priority,
        message,
      },
    });
  }

  /**
   * Fetch all unread alerts, newest first.
   * Only Admin and Manager users should call this.
   */
  static getUnreadAlerts() {
    return db.inventoryAlert.findMany({
      where: { isRead: false, resolvedAt: null },
      include: {
        consumableProfile: {
          select: {
            quantity: true,
            reorderPoint: true,
            unit: true,
            item: { select: { id: true, itemName: true } },
          },
        },
        borrowRecord: {
          select: {
            id: true,
            expectedReturn: true,
            status: true,
            equipment: {
              select: {
                assetId: true,
                item: { select: { id: true, itemName: true } },
              },
            },
            borrowedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Fetch all alerts (read + unread), paginated.
   */
  static async getAllAlerts(page = 1, pageSize = 30) {
    const skip = (page - 1) * pageSize;
    const [alerts, total] = await Promise.all([
      db.inventoryAlert.findMany({
        skip,
        take: pageSize,
        include: {
          consumableProfile: {
            select: {
              quantity: true,
              reorderPoint: true,
              unit: true,
              item: { select: { id: true, itemName: true } },
            },
          },
          borrowRecord: {
            select: {
              id: true,
              expectedReturn: true,
              status: true,
              equipment: {
                select: {
                  assetId: true,
                  item: { select: { id: true, itemName: true } },
                },
              },
              borrowedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.inventoryAlert.count(),
    ]);
    return { alerts, total, page, pageSize };
  }

  /**
   * Mark a single alert as read.
   */
  static markAsRead(alertId: number) {
    return db.inventoryAlert.update({
      where: { id: alertId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all unread alerts as read.
   */
  static markAllAsRead() {
    return db.inventoryAlert.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Count of unread, unresolved alerts — used for the bell badge.
   */
  static getUnreadCount() {
    return db.inventoryAlert.count({
      where: { isRead: false, resolvedAt: null },
    });
  }

  /**
   * Delete read alerts older than 24 hours to prevent overflow.
   * Called on server startup and can be triggered manually.
   */
  static async purgeOldAlerts(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.inventoryAlert.deleteMany({
      where: {
        isRead: true,
        readAt: { lt: cutoff },
      },
    });
  }

  /**
   * Run a full scan of all consumable profiles and generate
   * alerts for any that are currently low/out of stock.
   * Useful for a startup sync or a scheduled job.
   */
  static async runFullScan(): Promise<void> {
    const profiles = await db.consumableProfile.findMany({
      where: {
        item: { deletedAt: null },
        status: { not: 'ARCHIVED' },
      },
      select: { id: true },
    });

    for (const profile of profiles) {
      await AlertService.checkAndCreateStockAlert(profile.id);
    }
  }

  // ── Overdue equipment alerts ─────────────────────────────────────────────────

  /**
   * Creates (or refreshes) an OVERDUE_EQUIPMENT alert for a single borrow
   * record that is currently in the OVERDUE state. Deduplicates the same
   * way checkAndCreateStockAlert does: skips if an unresolved alert for
   * this borrow record was already created within the cooldown window.
   */
  static async checkAndCreateOverdueAlert(
    borrowRecordId: number,
  ): Promise<void> {
    const record = await db.borrowRecord.findUnique({
      where: { id: borrowRecordId },
      include: {
        equipment: {
          select: { assetId: true, item: { select: { itemName: true } } },
        },
        borrowedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!record || record.status !== BorrowStatus.OVERDUE) return;

    const cooldownFrom = new Date(Date.now() - ALERT_COOLDOWN_MS);
    const existing = await db.inventoryAlert.findFirst({
      where: {
        borrowRecordId,
        alertType: 'OVERDUE_EQUIPMENT',
        resolvedAt: null,
        createdAt: { gte: cooldownFrom },
      },
    });

    if (existing) return;

    const borrowerName =
      `${record.borrowedBy.firstName} ${record.borrowedBy.lastName}`.trim();
    const dueDate = record.expectedReturn.toISOString().split('T')[0];

    await db.inventoryAlert.create({
      data: {
        borrowRecordId,
        alertType: 'OVERDUE_EQUIPMENT',
        priority: 'CRITICAL',
        message: `"${record.equipment.item.itemName}" (${record.equipment.assetId}) borrowed by ${borrowerName} was due back on ${dueDate} and is now overdue.`,
      },
    });
  }

  /**
   * Resolves any open OVERDUE_EQUIPMENT alerts whose borrow record is no
   * longer overdue (e.g. it was returned or cancelled after the alert was
   * raised), so the alerts dropdown / notifications list stays in sync.
   */
  static async resolveStaleOverdueAlerts(): Promise<void> {
    // updateMany() can't filter on relations directly, so first collect the
    // ids of open OVERDUE_EQUIPMENT alerts whose linked borrow record is no
    // longer overdue, then resolve them by id.
    const staleAlerts = await db.inventoryAlert.findMany({
      where: {
        alertType: 'OVERDUE_EQUIPMENT',
        resolvedAt: null,
        borrowRecord: { status: { not: BorrowStatus.OVERDUE } },
      },
      select: { id: true },
    });

    if (staleAlerts.length === 0) return;

    await db.inventoryAlert.updateMany({
      where: { id: { in: staleAlerts.map((a) => a.id) } },
      data: { resolvedAt: new Date(), isRead: true, readAt: new Date() },
    });
  }

  /**
   * Full overdue-equipment check: flags any newly-overdue borrow records,
   * raises/refreshes alerts for everything currently overdue, and resolves
   * alerts for anything that stopped being overdue (returned/cancelled).
   * This is the entry point for both the manual "run overdue check" action
   * and the scheduled job.
   */
  static async runOverdueScan(): Promise<void> {
    await AlertService.resolveStaleOverdueAlerts();

    // Flag newly overdue records
    await BorrowService.flagOverdue();

    // Fetch all overdue records to ensure they have active alerts
    const allOverdue = await db.borrowRecord.findMany({
      where: { status: BorrowStatus.OVERDUE },
    });

    for (const record of allOverdue) {
      await AlertService.checkAndCreateOverdueAlert(record.id);
    }
  }
}
