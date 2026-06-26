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

// ── Service ───────────────────────────────────────────────────────────────────

export class BorrowService {
  // ── Guards ──────────────────────────────────────────────────────────────────

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

  /**
   * Approves a PENDING borrow request: flips the request to APPROVED, sets
   * borrowDate to now, and transitions the equipment to BORROWED so it drops
   * out of any AVAILABLE-filtered list.
   *
   * Both state transitions use updateMany() with the expected prior state
   * baked into the `where` clause (status: PENDING / status: AVAILABLE)
   * rather than a separate findUnique() read followed by an update(). This
   * makes the check-and-set atomic at the database level: Postgres only
   * matches and locks rows that still satisfy the where clause at the
   * moment of the write, so two concurrent approve() calls for the same
   * equipment can no longer both read AVAILABLE and both write BORROWED.
   * The loser's updateMany() simply matches zero rows.
   */
  static async approve(id: number, approverId: number) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.borrowRecord.findUnique({
        where: { id },
        select: { id: true, equipmentId: true },
      });
      if (!existing) {
        throw new Error('Borrow record not found');
      }

      // Atomic check-and-set: only matches if the equipment is still
      // AVAILABLE at the moment this statement executes.
      const eqUpdate = await tx.equipment.updateMany({
        where: { id: existing.equipmentId, status: EquipmentStatus.AVAILABLE },
        data: { status: EquipmentStatus.BORROWED },
      });
      if (eqUpdate.count === 0) {
        throw new Error('Equipment is currently unavailable');
      }

      // Atomic check-and-set: only matches if the request is still PENDING
      // at the moment this statement executes.
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

  // ── Reject ───────────────────────────────────────────────────────────────────

  /**
   * Rejects a PENDING borrow request. The equipment is never touched — it
   * was never reserved in the first place, so it simply stays AVAILABLE.
   *
   * Uses the same atomic updateMany() pattern as approve() so a concurrent
   * approve/reject on the same record can't both succeed against a stale
   * in-memory PENDING read.
   */
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

  /**
   * Processes the physical return of borrowed equipment.
   *
   * Business rules:
   *   1. The borrow record must be in BORROWED or APPROVED status. Any other
   *      status (RETURNED, REJECTED, PENDING, CANCELLED) is rejected with a
   *      409 Conflict so the UI can surface a clear message.
   *   2. If the current date is past expectedReturn the transaction is stamped
   *      as OVERDUE and logged separately so late returns appear in the audit
   *      trail with an OVERDUE action. On-time returns use RETURNED.
   *   3. Equipment status is unconditionally set back to AVAILABLE — condition
   *      is recorded on the borrow record, not the equipment row, so the
   *      equipment remains available for future borrows regardless of return
   *      condition (a maintenance ticket would be a separate flow).
   *
   * Uses updateMany() with the expected prior status baked into the WHERE
   * clause (same atomic check-and-set pattern as approve/reject) to prevent
   * duplicate returns from concurrent requests.
   */
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
        },
      });

      if (!existing) {
        throw new Error('Borrow record not found');
      }

      // Only BORROWED or APPROVED records can be returned. APPROVED covers
      // the edge case where a manager approved but the borrower never
      // physically picked it up and is returning it immediately.
      if (
        existing.status !== BorrowStatus.BORROWED &&
        existing.status !== BorrowStatus.APPROVED
      ) {
        if (existing.status === BorrowStatus.RETURNED) {
          throw new Error('Equipment has already been returned');
        }
        throw new Error(
          `Cannot process return — borrow record is currently ${existing.status}`,
        );
      }

      const now = new Date();
      const isLate = now > new Date(existing.expectedReturn);
      const finalStatus = isLate ? BorrowStatus.OVERDUE : BorrowStatus.RETURNED;
      const auditAction = isLate ? LogAction.UPDATED : LogAction.RETURNED;

      // Atomic check-and-set: only matches if the record is still
      // BORROWED or APPROVED at the moment this statement executes.
      const recordUpdate = await tx.borrowRecord.updateMany({
        where: {
          id,
          status: { in: [BorrowStatus.BORROWED, BorrowStatus.APPROVED] },
        },
        data: {
          status: finalStatus,
          actualReturn: now,
          returnCondition: data.returnCondition,
          notes: data.notes
            ? [existing.status, data.notes].filter(Boolean).join('\n')
            : undefined,
        },
      });

      if (recordUpdate.count === 0) {
        throw new Error(
          'Return could not be processed — record state changed concurrently',
        );
      }

      // Always restore equipment to AVAILABLE so it reappears in the
      // available list immediately after return.
      await tx.equipment.update({
        where: { id: existing.equipmentId },
        data: { status: EquipmentStatus.AVAILABLE },
      });

      const updated = await tx.borrowRecord.findUniqueOrThrow({
        where: { id },
        include: borrowInclude,
      });

      // Log with RETURNED for on-time, UPDATED for overdue so auditors can
      // distinguish late returns in the audit trail.
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
