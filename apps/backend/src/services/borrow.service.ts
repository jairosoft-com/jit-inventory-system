import { prisma } from '../lib/prisma.js';
import { EquipmentStatus, BorrowStatus, Prisma } from '@prisma/client';
import type {
  CreateBorrowInput,
  ListBorrowQuery,
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
}
