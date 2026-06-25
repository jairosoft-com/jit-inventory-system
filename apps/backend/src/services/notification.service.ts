import { prisma } from '../lib/prisma.js';
import { NotificationType } from '@prisma/client';

export class NotificationService {
  // ── Create ──────────────────────────────────────────────────────────────────

  static async create(
    userId: number,
    borrowRecordId: number,
    type: NotificationType,
    message: string,
  ) {
    return prisma.notification.create({
      data: {
        userId,
        borrowRecordId,
        type,
        message,
      },
    });
  }

  // ── List (for a user) ────────────────────────────────────────────────────────

  static async findAll(userId: number, onlyUnresolved = false) {
    return prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnresolved && { isResolved: false }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Resolve ──────────────────────────────────────────────────────────────────

  static async resolve(id: number) {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return prisma.notification.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });
  }

  // ── Resolve all by borrowRecordId ────────────────────────────────────────────
  // Called when equipment is returned — closes all open overdue notifications
  // for that borrow record automatically.

  static async resolveAllByBorrowRecord(borrowRecordId: number) {
    return prisma.notification.updateMany({
      where: {
        borrowRecordId,
        isResolved: false,
      },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });
  }

  // ── Check if overdue notification already exists ─────────────────────────────
  // Prevents the overdue job from spamming duplicate notifications on every run.

  static async overdueNotificationExists(
    borrowRecordId: number,
    userId: number,
  ) {
    const existing = await prisma.notification.findFirst({
      where: {
        borrowRecordId,
        userId,
        type: NotificationType.BORROW_OVERDUE,
        isResolved: false,
      },
    });

    return existing !== null;
  }
}