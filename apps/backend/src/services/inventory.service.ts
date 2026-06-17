import { prisma } from '../lib/prisma.js';
import { ItemStatus, MovementType, Prisma, LogAction } from '@prisma/client';
import { AuditLogService } from './audit-log.service.js';
import type {
  StockInInput,
  StockOutInput,
  StockAdjustmentInput,
  ListMovementsQuery,
} from '../schemas/inventory.schema.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recalculates the ItemStatus for a consumable profile based on its quantity
 * and reorder point. ARCHIVED is preserved if already set, since transactional
 * stock changes should not "un-archive" an item.
 */
function recalculateStatus(
  quantity: number,
  reorderPoint: number,
  currentStatus: ItemStatus,
): ItemStatus {
  if (currentStatus === ItemStatus.ARCHIVED) return ItemStatus.ARCHIVED;
  if (quantity <= 0) return ItemStatus.OUT_OF_STOCK;
  if (quantity <= reorderPoint) return ItemStatus.LOW_STOCK;
  return ItemStatus.IN_STOCK;
}

// ── Shared includes ───────────────────────────────────────────────────────────

const movementInclude = Prisma.validator<Prisma.StockMovementInclude>()({
  consumableProfile: {
    select: {
      id: true,
      unit: true,
      quantity: true,
      reorderPoint: true,
      status: true,
      item: { select: { id: true, itemName: true } },
    },
  },
  performedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
});

// ── Service ───────────────────────────────────────────────────────────────────

export class InventoryService {
  // ── Guards ──────────────────────────────────────────────────────────────────

  private static async findProfileOrThrow(consumableProfileId: number) {
    const profile = await prisma.consumableProfile.findUnique({
      where: { id: consumableProfileId },
      include: { item: { select: { id: true, itemName: true } } },
    });
    if (!profile) {
      throw new Error('Consumable profile not found');
    }
    return profile;
  }

  // ── Scenario 1: Stock In ────────────────────────────────────────────────────

  static async processStockIn(input: StockInInput, userId: number) {
    const { consumableProfileId, quantityAdded, purchaseOrderId, notes } =
      input;

    return prisma.$transaction(async (tx) => {
      const profile = await tx.consumableProfile.findUnique({
        where: { id: consumableProfileId },
        include: { item: { select: { id: true, itemName: true } } },
      });
      if (!profile) {
        throw new Error('Consumable profile not found');
      }
      if (profile.status === ItemStatus.ARCHIVED) {
        throw new Error(
          'Cannot process stock transactions on an archived item',
        );
      }

      const quantityBefore = profile.quantity;
      const quantityAfter = quantityBefore + quantityAdded;
      const newStatus = recalculateStatus(
        quantityAfter,
        profile.reorderPoint,
        profile.status,
      );

      const stockIn = await tx.stockIn.create({
        data: {
          consumableProfileId,
          quantityAdded,
          purchaseOrderId: purchaseOrderId ?? null,
          receivedById: userId,
          notes: notes ?? null,
        },
      });

      const updatedProfile = await tx.consumableProfile.update({
        where: { id: consumableProfileId },
        data: { quantity: quantityAfter, status: newStatus },
        include: { item: { select: { id: true, itemName: true } } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          consumableProfileId,
          movementType: MovementType.STOCK_IN,
          quantityChange: quantityAdded,
          quantityBefore,
          quantityAfter,
          reason: notes?.trim() || 'Stock received',
          referenceType: 'STOCK_IN',
          referenceId: stockIn.id,
          performedById: userId,
        },
      });

      await AuditLogService.log(
        'ConsumableProfile',
        consumableProfileId,
        LogAction.UPDATED,
        userId,
        { quantity: quantityBefore, status: profile.status },
        { quantity: quantityAfter, status: newStatus },
        tx,
      );

      return { profile: updatedProfile, stockIn, movement };
    });
  }

  // ── Scenario 2: Stock Out ───────────────────────────────────────────────────

  static async processStockOut(input: StockOutInput, userId: number) {
    const { consumableProfileId, quantityRemoved, purpose, notes } = input;

    return prisma.$transaction(async (tx) => {
      const profile = await tx.consumableProfile.findUnique({
        where: { id: consumableProfileId },
        include: { item: { select: { id: true, itemName: true } } },
      });
      if (!profile) {
        throw new Error('Consumable profile not found');
      }
      if (profile.status === ItemStatus.ARCHIVED) {
        throw new Error(
          'Cannot process stock transactions on an archived item',
        );
      }

      const quantityBefore = profile.quantity;
      if (quantityBefore < quantityRemoved) {
        throw new Error('Insufficient stock quantity');
      }

      const quantityAfter = quantityBefore - quantityRemoved;
      const newStatus = recalculateStatus(
        quantityAfter,
        profile.reorderPoint,
        profile.status,
      );

      const stockOut = await tx.stockOut.create({
        data: {
          consumableProfileId,
          quantityRemoved,
          purpose,
          releasedById: userId,
          notes: notes ?? null,
        },
      });

      const updatedProfile = await tx.consumableProfile.update({
        where: { id: consumableProfileId },
        data: { quantity: quantityAfter, status: newStatus },
        include: { item: { select: { id: true, itemName: true } } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          consumableProfileId,
          movementType: MovementType.STOCK_OUT,
          quantityChange: -quantityRemoved,
          quantityBefore,
          quantityAfter,
          reason: purpose,
          referenceType: 'STOCK_OUT',
          referenceId: stockOut.id,
          performedById: userId,
        },
      });

      await AuditLogService.log(
        'ConsumableProfile',
        consumableProfileId,
        LogAction.UPDATED,
        userId,
        { quantity: quantityBefore, status: profile.status },
        { quantity: quantityAfter, status: newStatus },
        tx,
      );

      return { profile: updatedProfile, stockOut, movement };
    });
  }

  // ── Scenario 3: Quantity Adjustment ─────────────────────────────────────────

  static async processAdjustment(input: StockAdjustmentInput, userId: number) {
    const { consumableProfileId, newQuantity, quantityChange, reason, notes } =
      input;

    return prisma.$transaction(async (tx) => {
      const profile = await tx.consumableProfile.findUnique({
        where: { id: consumableProfileId },
        include: { item: { select: { id: true, itemName: true } } },
      });
      if (!profile) {
        throw new Error('Consumable profile not found');
      }
      if (profile.status === ItemStatus.ARCHIVED) {
        throw new Error(
          'Cannot process stock transactions on an archived item',
        );
      }

      const quantityBefore = profile.quantity;
      const quantityAfter =
        newQuantity !== undefined
          ? newQuantity
          : quantityBefore + (quantityChange as number);

      if (quantityAfter < 0) {
        throw new Error('Adjusted quantity cannot be negative');
      }

      const difference = quantityAfter - quantityBefore;
      const newStatus = recalculateStatus(
        quantityAfter,
        profile.reorderPoint,
        profile.status,
      );

      const adjustment = await tx.stockAdjustment.create({
        data: {
          consumableProfileId,
          quantityBefore,
          quantityAfter,
          difference,
          reason,
          notes: notes ?? null,
          adjustedById: userId,
        },
      });

      const updatedProfile = await tx.consumableProfile.update({
        where: { id: consumableProfileId },
        data: { quantity: quantityAfter, status: newStatus },
        include: { item: { select: { id: true, itemName: true } } },
      });

      const movementReason = notes?.trim()
        ? `${reason}: ${notes.trim()}`
        : reason;

      const movement = await tx.stockMovement.create({
        data: {
          consumableProfileId,
          movementType:
            difference >= 0
              ? MovementType.ADJUSTMENT_ADD
              : MovementType.ADJUSTMENT_REMOVE,
          quantityChange: difference,
          quantityBefore,
          quantityAfter,
          reason: movementReason,
          referenceType: 'ADJUSTMENT',
          referenceId: adjustment.id,
          performedById: userId,
        },
      });

      await AuditLogService.log(
        'ConsumableProfile',
        consumableProfileId,
        LogAction.UPDATED,
        userId,
        { quantity: quantityBefore, status: profile.status },
        { quantity: quantityAfter, status: newStatus },
        tx,
      );

      return { profile: updatedProfile, adjustment, movement };
    });
  }

  // ── Scenario 4: Movement History ────────────────────────────────────────────

  static async listMovements(query: ListMovementsQuery) {
    const { consumableProfileId, movementType, dateFrom, dateTo, page, limit } =
      query;

    const where: Prisma.StockMovementWhereInput = {
      ...(consumableProfileId !== undefined && { consumableProfileId }),
      ...(movementType !== undefined && { movementType }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: movementInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
