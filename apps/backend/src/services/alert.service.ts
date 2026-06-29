import { prisma } from '../lib/prisma.js';

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
    const profile = await prisma.consumableProfile.findUnique({
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
      await prisma.inventoryAlert.updateMany({
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
    const existing = await prisma.inventoryAlert.findFirst({
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
    await prisma.inventoryAlert.updateMany({
      where: {
        consumableProfileId,
        alertType: { not: alertType },
        resolvedAt: null,
      },
      data: { resolvedAt: new Date(), isRead: true, readAt: new Date() },
    });

    // Create the new alert
    await prisma.inventoryAlert.create({
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
    return prisma.inventoryAlert.findMany({
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
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Fetch all alerts (read + unread), paginated.
   */
  static async getAllAlerts(page = 1, pageSize = 30) {
    const skip = (page - 1) * pageSize;
    const [alerts, total] = await Promise.all([
      prisma.inventoryAlert.findMany({
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
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventoryAlert.count(),
    ]);
    return { alerts, total, page, pageSize };
  }

  /**
   * Mark a single alert as read.
   */
  static markAsRead(alertId: number) {
    return prisma.inventoryAlert.update({
      where: { id: alertId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all unread alerts as read.
   */
  static markAllAsRead() {
    return prisma.inventoryAlert.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Count of unread, unresolved alerts — used for the bell badge.
   */
  static getUnreadCount() {
    return prisma.inventoryAlert.count({
      where: { isRead: false, resolvedAt: null },
    });
  }

  /**
   * Delete read alerts older than 24 hours to prevent overflow.
   * Called on server startup and can be triggered manually.
   */
  static async purgeOldAlerts(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.inventoryAlert.deleteMany({
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
    const profiles = await prisma.consumableProfile.findMany({
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
}