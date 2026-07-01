import { prisma } from '../lib/prisma.js';
import {
  EquipmentStatus,
  BorrowStatus,
  Prisma,
  LogAction,
} from '@prisma/client';
import { AuditLogService } from './audit-log.service.js';
import type {
  CreateBorrowInput,
  ListBorrowQuery,
  ProcessReturnInput,
  RejectBorrowInput,
} from '../schemas/borrow.schema.js';

// ── Shared include ────────────────────────────────────────────────────────────

const borrowInclude = Prisma.validator<Prisma.BorrowRecordInclude>()({
  equipment: {
    include: {
      item: {
        select: { id: true, itemName: true, imageUrl: true },
      },
      images: {
        where: { isPrimary: true, deletedAt: null },
        take: 1,
      },
    },
  },
  borrowedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  approvedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  return new Date(date.toLocaleDateString('sv-SE'));
}

// ── Service ───────────────────────────────────────────────────────────────────

export class BorrowService {
  // ── Guards ──────────────────────────────────────────────────────────────────

  /**
   * Promotes any APPROVED/BORROWED record whose expectedReturn date has
   * already passed to OVERDUE, and returns the records that were just
   * flagged (with the relations AlertService needs to raise overdue-
   * equipment alerts for them). Nothing in this codebase ever wrote
   * BorrowStatus.OVERDUE to the database — the dashboard only *computed* an
   * overdue count on the fly — so list/history views kept showing stale
   * "Approved"/"Borrowed" badges and `?status=OVERDUE` filtering returned
   * nothing.
   *
   * This is a passive, time-derived transition rather than something a user
   * did, so (unlike approve/reject/return) it is intentionally not written
   * to the audit trail, which records actions performed by a specific user.
   */
  static async flagOverdue() {
    const today = startOfDay(new Date());

    const toFlag = await prisma.borrowRecord.findMany({
      where: {
        status: { in: [BorrowStatus.APPROVED, BorrowStatus.BORROWED] },
        expectedReturn: { lt: today },
      },
      include: {
        equipment: {
          select: { assetId: true, item: { select: { itemName: true } } },
        },
        borrowedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (toFlag.length === 0) return toFlag;

    await prisma.borrowRecord.updateMany({
      where: { id: { in: toFlag.map((record) => record.id) } },
      data: { status: BorrowStatus.OVERDUE },
    });

    return toFlag;
  }

  /**
   * Called before every read so the stored status is always accurate by
   * the time it reaches the API response. Thin wrapper around
   * `flagOverdue()` for call sites that only need the side effect.
   */
  private static async syncOverdueStatuses(): Promise<void> {
    await BorrowService.flagOverdue();
  }

  /**
   * Ensures the equipment exists, is active, and is currently AVAILABLE.
   * Throws a descriptive error on any violation.
   */
  private static async assertEquipmentAvailable(equipmentId: number) {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, status: true, deletedAt: true, assetId: true },
    });

    if (!equipment || equipment.deletedAt) {
      throw new Error('Equipment not found');
    }

    if (equipment.status !== EquipmentStatus.AVAILABLE) {
      throw new Error('Equipment is currently unavailable');
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  static async create(data: CreateBorrowInput, requestedById: number) {
    await this.assertEquipmentAvailable(data.equipmentId);

    const record = await prisma.borrowRecord.create({
      data: {
        equipmentId: data.equipmentId,
        borrowedById: requestedById,
        expectedReturn: data.expectedReturn,
        notes: data.notes ?? null,
        status: BorrowStatus.PENDING,
      },
      include: borrowInclude,
    });

    await AuditLogService.log(
      'BorrowRecord',
      record.id,
      LogAction.CREATED,
      requestedById,
      null,
      record,
    );

    return record;
  }

  // ── List ────────────────────────────────────────────────────────────────────

  static async findAll(query: ListBorrowQuery, requestingUserId: number) {
    await this.syncOverdueStatuses();

    const { status, equipmentId, borrowedById, mine, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BorrowRecordWhereInput = {
      // If ?mine=true, scope to the requesting user regardless of other filters
      ...(mine && { borrowedById: requestingUserId }),
      // Otherwise allow explicit borrowedById filter (admin use)
      ...(!mine && borrowedById !== undefined && { borrowedById }),
      ...(status !== undefined && { status }),
      ...(equipmentId !== undefined && { equipmentId }),
    };

    const [data, total] = await Promise.all([
      prisma.borrowRecord.findMany({
        where,
        include: borrowInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.borrowRecord.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Find one ─────────────────────────────────────────────────────────────────

  static async findOne(id: number) {
    await this.syncOverdueStatuses();

    const record = await prisma.borrowRecord.findUnique({
      where: { id },
      include: borrowInclude,
    });

    if (!record) {
      throw new Error('Borrow record not found');
    }

    return record;
  }

  // ── Approve ──────────────────────────────────────────────────────────────────

  static async approve(id: number, approverId: number) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.borrowRecord.findUnique({
        where: { id },
        select: { id: true, equipmentId: true },
      });
      if (!existing) {
        throw new Error('Borrow record not found');
      }

      const eqUpdate = await tx.equipment.updateMany({
        where: { id: existing.equipmentId, status: EquipmentStatus.AVAILABLE },
        data: { status: EquipmentStatus.BORROWED },
      });
      if (eqUpdate.count === 0) {
        throw new Error('Equipment is currently unavailable');
      }

      const recordUpdate = await tx.borrowRecord.updateMany({
        where: { id, status: BorrowStatus.PENDING },
        data: {
          status: BorrowStatus.APPROVED,
          approvedById: approverId,
          borrowDate: new Date(),
        },
      });
      if (recordUpdate.count === 0) {
        throw new Error('Borrow record not found or no longer PENDING');
      }

      return tx.borrowRecord.findUniqueOrThrow({
        where: { id },
        include: borrowInclude,
      });
    });
  }

  static async reject(id: number, approverId: number, data: RejectBorrowInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.borrowRecord.findUnique({
        where: { id },
        select: { id: true, notes: true },
      });
      if (!existing) {
        throw new Error('Borrow record not found');
      }

      const recordUpdate = await tx.borrowRecord.updateMany({
        where: { id, status: BorrowStatus.PENDING },
        data: {
          status: BorrowStatus.REJECTED,
          approvedById: approverId,
          notes: data.reason
            ? [existing.notes, `Rejection reason: ${data.reason}`]
                .filter(Boolean)
                .join('\n')
            : existing.notes,
        },
      });
      if (recordUpdate.count === 0) {
        throw new Error('Borrow record not found or no longer PENDING');
      }

      return tx.borrowRecord.findUniqueOrThrow({
        where: { id },
        include: borrowInclude,
      });
    });
  }

  // ── Process Return ────────────────────────────────────────────────────────────

  static async processReturn(
    id: number,
    data: ProcessReturnInput,
    processedById: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.borrowRecord.findUnique({
        where: { id },
        select: {
          id: true,
          equipmentId: true,
          status: true,
          expectedReturn: true,
          notes: true,
        },
      });

      if (!existing) {
        throw new Error('Borrow record not found');
      }

      if (
        existing.status !== BorrowStatus.BORROWED &&
        existing.status !== BorrowStatus.APPROVED &&
        existing.status !== BorrowStatus.OVERDUE
      ) {
        if (existing.status === BorrowStatus.RETURNED) {
          throw new Error('Equipment has already been returned');
        }
        throw new Error(
          `Cannot process return — borrow record is currently ${existing.status}`,
        );
      }

      const now = new Date();

      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const expectedStr = new Date(existing.expectedReturn)
        .toISOString()
        .split('T')[0];
      const isLate = todayStr > expectedStr;

      const finalStatus = BorrowStatus.RETURNED;
      const auditAction = isLate ? LogAction.UPDATED : LogAction.RETURNED;

      const recordUpdate = await tx.borrowRecord.updateMany({
        where: {
          id,
          status: {
            in: [
              BorrowStatus.BORROWED,
              BorrowStatus.APPROVED,
              BorrowStatus.OVERDUE,
            ],
          },
        },
        data: {
          status: finalStatus,
          actualReturn: now,
          returnCondition: data.returnCondition,
          notes: data.notes
            ? [existing.notes, `[Return Notes] ${data.notes}`]
                .filter(Boolean)
                .join('\n')
            : existing.notes,
        },
      });

      if (recordUpdate.count === 0) {
        throw new Error(
          'Return could not be processed — record state changed concurrently',
        );
      }

      await tx.equipment.update({
        where: { id: existing.equipmentId },
        data: {
          status: EquipmentStatus.AVAILABLE,
          // The condition logged on this return (FAIR/POOR/DAMAGED, etc.)
          // must carry over to the equipment's own record — otherwise the
          // asset keeps showing its last-known condition forever, and the
          // retirement-eligibility / replacement-planning checks in
          // equipment.service.ts (which read `equipment.condition`) never
          // see it either.
          condition: data.returnCondition,
        },
      });

      const updated = await tx.borrowRecord.findUniqueOrThrow({
        where: { id },
        include: borrowInclude,
      });

      await AuditLogService.log(
        'BorrowRecord',
        id,
        auditAction,
        processedById,
        { status: existing.status },
        { status: finalStatus, returnCondition: data.returnCondition, isLate },
        tx,
      );

      return { record: updated, isLate };
    });
  }
}
