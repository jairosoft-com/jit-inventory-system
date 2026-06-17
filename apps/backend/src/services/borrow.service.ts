import { prisma } from '../lib/prisma.js';
import { EquipmentStatus, BorrowStatus, Prisma } from '@prisma/client';
import type { CreateBorrowInput, ListBorrowQuery } from '../schemas/borrow.schema.js';

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
}
