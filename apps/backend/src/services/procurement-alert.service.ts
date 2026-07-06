import { PrismaClient, ProcurementAlertType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const db: PrismaClient = prisma;

type TransactionClient = Prisma.TransactionClient;

type ProcurementAlertHistoryQuery = {
  page?: number;
  pageSize?: number;
  alertType?: ProcurementAlertType;
};

export class ProcurementAlertService {
  // ── Create ───────────────────────────────────────────────────────────────────

  static async create(
    purchaseOrderId: number,
    userId: number,
    alertType: ProcurementAlertType,
    message: string,
    tx?: TransactionClient,
  ) {
    const client = tx ?? db;
    return client.procurementAlert.create({
      data: {
        purchaseOrderId,
        userId,
        alertType,
        message,
      },
    });
  }

  // ── Get Unread Alerts ────────────────────────────────────────────────────────

  static getUnreadAlerts(userId: number) {
    return db.procurementAlert.findMany({
      where: { isRead: false, userId },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            supplier: {
              select: { id: true, supplierName: true },
            },
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Get All Alerts (paginated) ───────────────────────────────────────────────

  static async getAllAlerts(page = 1, pageSize = 30) {
    const skip = (page - 1) * pageSize;
    const [alerts, total] = await Promise.all([
      db.procurementAlert.findMany({
        skip,
        take: pageSize,
        include: {
          purchaseOrder: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              supplier: {
                select: { id: true, supplierName: true },
              },
              createdBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.procurementAlert.count(),
    ]);
    return { alerts, total, page, pageSize };
  }

  // ── Get Alert History ───────────────────────────────────────────────────────

  static async getHistory(
    userId: number,
    isAdminOrManager: boolean,
    query: ProcurementAlertHistoryQuery = {},
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProcurementAlertWhereInput = {
      ...(isAdminOrManager ? {} : { userId }),
      ...(query.alertType ? { alertType: query.alertType } : {}),
    };

    const [alerts, total] = await Promise.all([
      db.procurementAlert.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          purchaseOrder: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              supplier: {
                select: { id: true, supplierName: true },
              },
              createdBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.procurementAlert.count({ where }),
    ]);

    return { alerts, total, page, pageSize };
  }

  // ── Mark as Read ─────────────────────────────────────────────────────────────

  static async markAsRead(
    alertId: number,
    userId: number,
    isAdminOrManager: boolean,
  ) {
    const result = await db.procurementAlert.updateMany({
      where: {
        id: alertId,
        ...(isAdminOrManager ? {} : { userId }),
      },
      data: { isRead: true, readAt: new Date() },
    });

    if (result.count === 0) {
      throw new Error('Procurement alert not found');
    }

    return db.procurementAlert.findUniqueOrThrow({
      where: { id: alertId },
    });
  }

  // ── Mark All as Read ─────────────────────────────────────────────────────────

  static markAllAsRead(userId: number) {
    return db.procurementAlert.updateMany({
      where: { isRead: false, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ── Get Unread Count ─────────────────────────────────────────────────────────

  static getUnreadCount(userId: number) {
    return db.procurementAlert.count({
      where: { isRead: false, userId },
    });
  }
}
