import {
  PrismaClient,
  Prisma,
  EquipmentStatus,
  BorrowStatus,
  AlertType,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendMail } from '../lib/mailer.js';
import { BorrowService } from './borrow.service.js';

// Typed alias ensures ESLint's type-checker resolves all Prisma model methods
const db: PrismaClient = prisma;

// How long to suppress duplicate alerts for the same item (24 hours)
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type AlertHistoryQuery = {
  page?: number;
  pageSize?: number;
  alertType?: AlertType;
};

// Per Decision 8 in the DevPlan
const WARRANTY_ALERT_WINDOW_DAYS = 30;
const WARRANTY_CRITICAL_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(target: Date, from: Date): number {
  return Math.ceil(
    (startOfDay(target).getTime() - startOfDay(from).getTime()) / MS_PER_DAY,
  );
}

const equipmentAlertInclude = {
  item: {
    select: {
      id: true,
      itemName: true,
      category: { select: { id: true, name: true } },
    },
  },
} as const;

export class AlertService {
  // ── Consumable stock alerts (existing) ──────────────────────────────────────

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

    const cooldownFrom = new Date(Date.now() - ALERT_COOLDOWN_MS);
    const existing = await db.inventoryAlert.findFirst({
      where: {
        consumableProfileId,
        alertType,
        resolvedAt: null,
        createdAt: { gte: cooldownFrom },
      },
    });

    if (existing) return;

    await db.inventoryAlert.updateMany({
      where: {
        consumableProfileId,
        alertType: { not: alertType },
        resolvedAt: null,
      },
      data: { resolvedAt: new Date(), isRead: true, readAt: new Date() },
    });

    await db.inventoryAlert.create({
      data: {
        consumableProfileId,
        alertType,
        priority,
        message,
      },
    });
  }

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

  // ── Equipment warranty expiration alerts (Task 206597) ──────────────────────

  static async runWarrantyScan(): Promise<void> {
    const today = startOfDay(new Date());
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + WARRANTY_ALERT_WINDOW_DAYS);

    const expiring = await db.equipment.findMany({
      where: {
        warrantyEnd: { not: null, lte: windowEnd },
        deletedAt: null,
        status: { not: EquipmentStatus.RETIRED },
        item: { deletedAt: null },
      },
      include: equipmentAlertInclude,
    });

    for (const equipment of expiring) {
      const daysRemaining = daysBetween(equipment.warrantyEnd!, today);
      const isExpired = daysRemaining < 0;
      const priority: 'WARNING' | 'CRITICAL' =
        isExpired || daysRemaining <= WARRANTY_CRITICAL_THRESHOLD_DAYS
          ? 'CRITICAL'
          : 'WARNING';
      const message = isExpired
        ? `"${equipment.item.itemName}" (${equipment.assetId}) warranty expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago (${equipment.warrantyEnd!.toDateString()}).`
        : `"${equipment.item.itemName}" (${equipment.assetId}) warranty expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${equipment.warrantyEnd!.toDateString()}).`;

      const existing = await db.inventoryAlert.findFirst({
        where: {
          equipmentId: equipment.id,
          alertType: 'WARRANTY_EXPIRING',
          resolvedAt: null,
        },
      });

      if (existing) {
        await db.inventoryAlert.update({
          where: { id: existing.id },
          data: { message, priority },
        });
      } else {
        await db.inventoryAlert.create({
          data: {
            equipmentId: equipment.id,
            alertType: 'WARRANTY_EXPIRING',
            priority,
            message,
          },
        });
      }
    }

    const openAlerts = await db.inventoryAlert.findMany({
      where: { alertType: 'WARRANTY_EXPIRING', resolvedAt: null },
      select: { id: true, equipmentId: true },
    });

    const stillValidIds = new Set(expiring.map((e) => e.id));
    const toResolve = openAlerts
      .filter(
        (a) => a.equipmentId !== null && !stillValidIds.has(a.equipmentId),
      )
      .map((a) => a.id);

    if (toResolve.length > 0) {
      await db.inventoryAlert.updateMany({
        where: { id: { in: toResolve } },
        data: { resolvedAt: new Date(), isRead: true, readAt: new Date() },
      });
    }
  }

  static async sendWarrantyDigestEmail(): Promise<void> {
    const today = startOfDay(new Date());
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + WARRANTY_ALERT_WINDOW_DAYS);

    const expiring = await db.equipment.findMany({
      where: {
        warrantyEnd: { not: null, lte: windowEnd },
        deletedAt: null,
        status: { not: EquipmentStatus.RETIRED },
        item: { deletedAt: null },
      },
      include: equipmentAlertInclude,
      orderBy: { warrantyEnd: 'asc' },
    });

    if (expiring.length === 0) return;

    const managers = await db.user.findMany({
      where: { isActive: true, deletedAt: null, role: { name: 'MANAGER' } },
      select: { email: true },
    });

    if (managers.length === 0) return;

    const rows = expiring
      .map((e) => {
        const daysRemaining = daysBetween(e.warrantyEnd!, today);
        const daysLabel =
          daysRemaining < 0
            ? `Expired ${Math.abs(daysRemaining)} day(s) ago`
            : `${daysRemaining} day(s)`;
        return `<tr><td>${e.item.itemName}</td><td>${e.assetId}</td><td>${e.warrantyEnd!.toDateString()}</td><td>${daysLabel}</td></tr>`;
      })
      .join('');

    const html = `
      <h2>Equipment Warranty Expiration Alert</h2>
      <p>${expiring.length} item(s) have a warranty expiring within the next ${WARRANTY_ALERT_WINDOW_DAYS} days:</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
        <thead><tr><th>Item</th><th>Asset ID</th><th>Warranty End</th><th>Days Remaining</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    await Promise.all(
      managers.map((m) =>
        sendMail({
          to: m.email,
          subject: `[JIT IMS] ${expiring.length} equipment warrant${expiring.length === 1 ? 'y' : 'ies'} expiring soon`,
          html,
        }),
      ),
    );
  }

  // ── Replacement-needed alerts (Task 206598) ──────────────────────────────────

  static async triggerReplacementAlert(equipmentId: number): Promise<boolean> {
    const existing = await db.inventoryAlert.findFirst({
      where: { equipmentId, alertType: 'REPLACEMENT_NEEDED', resolvedAt: null },
    });

    if (existing) return false;

    const equipment = await db.equipment.findUnique({
      where: { id: equipmentId },
      include: equipmentAlertInclude,
    });

    if (!equipment) return false;

    await db.inventoryAlert.create({
      data: {
        equipmentId,
        alertType: 'REPLACEMENT_NEEDED',
        priority: 'WARNING',
        message: `"${equipment.item.itemName}" (${equipment.assetId}) has been tagged for replacement.`,
      },
    });

    return true;
  }

  static async sendReplacementNeededEmail(equipmentId: number): Promise<void> {
    const equipment = await db.equipment.findUnique({
      where: { id: equipmentId },
      include: equipmentAlertInclude,
    });

    if (!equipment) return;

    const recipients = await db.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        role: { name: { in: ['ADMIN', 'MANAGER'] } },
      },
      select: { email: true },
    });

    if (recipients.length === 0) return;

    const html = `
      <h2>Equipment Replacement Needed</h2>
      <p><strong>${equipment.item.itemName}</strong> (Asset ID: ${equipment.assetId}) has been tagged for replacement${equipment.status === 'RETIRED' ? ' and has been retired' : ''}.</p>
    `;

    await Promise.all(
      recipients.map((r) =>
        sendMail({
          to: r.email,
          subject: `[JIT IMS] Replacement needed: ${equipment.item.itemName}`,
          html,
        }),
      ),
    );
  }

  // ── Read/query methods ───────────────────────────────────────────────────────

  static getUnreadAlerts(userId?: number, isAdminOrManager = false) {
    return db.inventoryAlert.findMany({
      where: {
        isRead: false,
        resolvedAt: null,
        OR: isAdminOrManager
          ? [{ userId: userId ?? undefined }, { userId: null }]
          : [{ userId: userId ?? undefined }],
      },
      include: {
        consumableProfile: {
          select: {
            quantity: true,
            reorderPoint: true,
            unit: true,
            item: { select: { id: true, itemName: true } },
          },
        },
        equipment: {
          select: {
            id: true,
            assetId: true,
            warrantyEnd: true,
            ...equipmentAlertInclude,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Fetch alert history (read + unread), paginated and optionally filtered
   * by notification category/type.
   */
  static async getAllAlerts(
    query: AlertHistoryQuery = {},
    userId?: number,
    isAdminOrManager = false,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    const skip = (page - 1) * pageSize;
    const where: Prisma.InventoryAlertWhereInput = {
      ...(query.alertType && { alertType: query.alertType }),
      OR: isAdminOrManager
        ? [{ userId: userId ?? undefined }, { userId: null }]
        : [{ userId: userId ?? undefined }],
    };

    const [alerts, total] = await Promise.all([
      db.inventoryAlert.findMany({
        where,
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
          equipment: {
            select: {
              id: true,
              assetId: true,
              warrantyEnd: true,
              ...equipmentAlertInclude,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.inventoryAlert.count({ where }),
    ]);
    return { alerts, total, page, pageSize };
  }

  static async markAsRead(
    alertId: number,
    userId?: number,
    isAdminOrManager = false,
  ) {
    const alert = await db.inventoryAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) throw new Error('Alert not found');

    const isOwnAlert = alert.userId !== null && alert.userId === userId;
    const isGlobalAlert = alert.userId === null;

    if (!isOwnAlert && !(isGlobalAlert && isAdminOrManager)) {
      throw new Error('Forbidden: you do not own this alert');
    }

    return db.inventoryAlert.update({
      where: { id: alertId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static markAllAsRead(userId?: number, isAdminOrManager = false) {
    return db.inventoryAlert.updateMany({
      where: {
        isRead: false,
        OR: isAdminOrManager
          ? [{ userId: userId ?? undefined }, { userId: null }]
          : [{ userId: userId ?? undefined }],
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static getUnreadCount(userId?: number, isAdminOrManager = false) {
    return db.inventoryAlert.count({
      where: {
        isRead: false,
        resolvedAt: null,
        OR: isAdminOrManager
          ? [{ userId: userId ?? undefined }, { userId: null }]
          : [{ userId: userId ?? undefined }],
      },
    });
  }

  static async purgeOldAlerts(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.inventoryAlert.deleteMany({
      where: {
        isRead: true,
        readAt: { lt: cutoff },
      },
    });
  }

  // ── Overdue equipment alerts ─────────────────────────────────────────────────

  static async checkAndCreateOverdueAlert(
    borrowRecordId: number,
  ): Promise<void> {
    const record = await db.borrowRecord.findUnique({
      where: { id: borrowRecordId },
      include: {
        equipment: {
          select: { assetId: true, item: { select: { itemName: true } } },
        },
        borrowedBy: { select: { id: true, firstName: true, lastName: true } },
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
    const borrowedById = record.borrowedBy.id;
    const dueDate = record.expectedReturn.toISOString().split('T')[0];

    // Notify the borrower personally
    await db.inventoryAlert.create({
      data: {
        borrowRecordId,
        userId: borrowedById,
        alertType: 'OVERDUE_EQUIPMENT',
        priority: 'CRITICAL',
        message: `Your borrowed equipment "${record.equipment.item.itemName}" (${record.equipment.assetId}) was due back on ${dueDate} and is now overdue. Please return it immediately.`,
      },
    });

    // Notify managers/admins (global alert - no userId)
    await db.inventoryAlert.create({
      data: {
        borrowRecordId,
        alertType: 'OVERDUE_EQUIPMENT',
        priority: 'CRITICAL',
        message: `"${record.equipment.item.itemName}" (${record.equipment.assetId}) borrowed by ${borrowerName} was due back on ${dueDate} and is now overdue.`,
      },
    });
  }

  static async resolveStaleOverdueAlerts(): Promise<void> {
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

  static async runOverdueScan(): Promise<void> {
    await AlertService.resolveStaleOverdueAlerts();

    await BorrowService.flagOverdue();

    const allOverdue = await db.borrowRecord.findMany({
      where: { status: BorrowStatus.OVERDUE },
    });

    for (const record of allOverdue) {
      await AlertService.checkAndCreateOverdueAlert(record.id);
    }
  }

  // ── Borrow return alert ──────────────────────────────────────────────────────

  static async createReturnAlert(
    borrowRecordId: number,
    borrowedById: number,
    equipmentName: string,
    assetId: string,
    tx: Prisma.TransactionClient | PrismaClient = db,
  ): Promise<void> {
    await tx.inventoryAlert.create({
      data: {
        borrowRecordId,
        userId: borrowedById,
        alertType: 'BORROW_RETURNED',
        priority: 'WARNING',
        message: `Your borrowed equipment "${equipmentName}" (${assetId}) has been successfully returned. Thank you!`,
      },
    });
  }

  static async resolveOverdueAlertsForBorrow(
    borrowRecordId: number,
    tx: Prisma.TransactionClient | PrismaClient = db,
  ): Promise<void> {
    await tx.inventoryAlert.updateMany({
      where: {
        borrowRecordId,
        alertType: 'OVERDUE_EQUIPMENT',
        resolvedAt: null,
      },
      data: { resolvedAt: new Date(), isRead: true, readAt: new Date() },
    });
  }
}
