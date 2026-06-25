import { prisma } from '../lib/prisma.js';
import { BorrowStatus, NotificationType } from '@prisma/client';
import { NotificationService } from './notification.service.js';

// Runs on an interval to find overdue borrow records and notify
// the borrower and all managers/admins.

export async function checkOverdueBorrows() {
  const now = new Date();

  // Find all APPROVED/BORROWED records past their expected return date
  const overdueRecords = await prisma.borrowRecord.findMany({
    where: {
      status: {
        in: [BorrowStatus.APPROVED, BorrowStatus.BORROWED],
      },
      expectedReturn: {
        lt: now,
      },
    },
    include: {
      borrowedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      equipment: {
        include: {
          item: { select: { itemName: true } },
        },
      },
    },
  });

  if (overdueRecords.length === 0) return;

  // Fetch all managers and admins to notify
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: {
        name: { in: ['ADMIN', 'MANAGER'] },
      },
    },
    select: { id: true },
  });

  for (const record of overdueRecords) {
    // Mark the borrow record as OVERDUE if not already
    if (record.status !== BorrowStatus.OVERDUE) {
      await prisma.borrowRecord.update({
        where: { id: record.id },
        data: { status: BorrowStatus.OVERDUE },
      });
    }

    const equipmentName = record.equipment.item.itemName;
    const borrowerName = `${record.borrowedBy.firstName} ${record.borrowedBy.lastName}`;
    const dueDate = record.expectedReturn.toDateString();

    // Notify borrower (skip if already notified)
    const borrowerAlreadyNotified =
      await NotificationService.overdueNotificationExists(
        record.id,
        record.borrowedBy.id,
      );

    if (!borrowerAlreadyNotified) {
      await NotificationService.create(
        record.borrowedBy.id,
        record.id,
        NotificationType.BORROW_OVERDUE,
        `Your borrowed equipment "${equipmentName}" was due on ${dueDate} and is now overdue. Please return it immediately.`,
      );
    }

    // Notify each manager/admin (skip if already notified)
    for (const manager of managers) {
      const managerAlreadyNotified =
        await NotificationService.overdueNotificationExists(
          record.id,
          manager.id,
        );

      if (!managerAlreadyNotified) {
        await NotificationService.create(
          manager.id,
          record.id,
          NotificationType.BORROW_OVERDUE,
          `Borrower ${borrowerName} has not returned "${equipmentName}" which was due on ${dueDate}.`,
        );
      }
    }
  }
}

// Starts the overdue job on server boot.
// Runs every hour (3_600_000 ms).

export function startOverdueJob() {
  console.log('[OverdueJob] Started — checking every hour.');
  void checkOverdueBorrows();
  setInterval(() => {
  void checkOverdueBorrows();
}, 3_600_000);
}