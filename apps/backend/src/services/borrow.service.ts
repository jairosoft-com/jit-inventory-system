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
   * out of any AVAILABLE-filtered list. Wrapped in a transaction so the
   * request and equipment status move together — no window where one is
   * updated and the other isn't.
   */
  static async approve(id: number, approverId: number) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.borrowRecord.findUnique({
        where: { id },
        include: { equipment: { select: { id: true, status: true } } },
      });

      if (!record) {
        throw new Error('Borrow record not found');
      }
      if (record.status !== BorrowStatus.PENDING) {
        throw new Error(
          `Cannot approve a request with status ${record.status}; only PENDING requests can be approved`,
        );
      }
      if (record.equipment.status !== EquipmentStatus.AVAILABLE) {
        // Defensive: covers the case where the equipment was already borrowed
        // or taken out of service between request submission and approval.
        throw new Error('Equipment is currently unavailable');
      }

      await tx.equipment.update({
        where: { id: record.equipmentId },
        data: { status: EquipmentStatus.BORROWED },
      });

      const updated = await tx.borrowRecord.update({
        where: { id },
        data: {
          status: BorrowStatus.APPROVED,
          approvedById: approverId,
          borrowDate: new Date(),
        },
        include: borrowInclude,
      });

      return updated;
    });
  }

  // ── Reject ───────────────────────────────────────────────────────────────────

  /**
   * Rejects a PENDING borrow request. The equipment is never touched — it
   * was never reserved in the first place, so it simply stays AVAILABLE.
   */
  static async reject(id: number, approverId: number, data: RejectBorrowInput) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.borrowRecord.findUnique({ where: { id } });

      if (!record) {
        throw new Error('Borrow record not found');
      }
      if (record.status !== BorrowStatus.PENDING) {
        throw new Error(
          `Cannot reject a request with status ${record.status}; only PENDING requests can be rejected`,
        );
      }

      const updated = await tx.borrowRecord.update({
        where: { id },
        data: {
          status: BorrowStatus.REJECTED,
          approvedById: approverId,
          notes: data.reason
            ? [record.notes, `Rejection reason: ${data.reason}`]
                .filter(Boolean)
                .join('\n')
            : record.notes,
        },
        include: borrowInclude,
      });

      return updated;
    });
  }
}
