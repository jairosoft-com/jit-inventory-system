import { PrismaClient, ProcurementAlertType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const db: PrismaClient = prisma;

export class ProcurementAlertService {
  // ── Create ───────────────────────────────────────────────────────────────────

  static async create(
    purchaseOrderId: number,
    alertType: ProcurementAlertType,
    message: string,
  ) {
    return db.procurementAlert.create({
      data: {
        purchaseOrderId,
        alertType,
        message,
      },
    });
  }

  // ── Get Unread Alerts ────────────────────────────────────────────────────────

  static getUnreadAlerts() {
    return db.procurementAlert.findMany({
      where: { isRead: false },
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

  // ── Mark as Read ─────────────────────────────────────────────────────────────

  static markAsRead(alertId: number) {
    return db.procurementAlert.update({
      where: { id: alertId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ── Mark All as Read ─────────────────────────────────────────────────────────

  static markAllAsRead() {
    return db.procurementAlert.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ── Get Unread Count ─────────────────────────────────────────────────────────

  static getUnreadCount() {
    return db.procurementAlert.count({
      where: { isRead: false },
    });
  }
}