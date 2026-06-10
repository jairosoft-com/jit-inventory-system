import { prisma } from '../lib/prisma.js';
import { ItemType, ItemStatus, Prisma } from '@prisma/client';
import type {
  CreateItemInput,
  UpdateItemInput,
  ListItemsQuery,
} from '../schemas/items.schema.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateStockStatus(
  quantity: number,
  reorderPoint: number,
): ItemStatus {
  if (quantity <= 0) return ItemStatus.OUT_OF_STOCK;
  if (quantity <= reorderPoint) return ItemStatus.LOW_STOCK;
  return ItemStatus.IN_STOCK;
}

function normalizeDuplicateText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

// ── Shared include ────────────────────────────────────────────────────────────

const itemInclude = Prisma.validator<Prisma.ItemInclude>()({
  category: { select: { id: true, name: true, type: true } },
  registeredByUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  consumableProfile: true,
  digitalAsset: true,
});

// ── Service ───────────────────────────────────────────────────────────────────

export class ItemsService {
  // ── Guards ──────────────────────────────────────────────────────────────────

  private static async assertCategoryMatchesType(
    categoryId: number,
    itemType: ItemType,
  ) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.deletedAt) {
      throw new Error('Category not found');
    }

    if (category.type !== itemType) {
      throw new Error(
        `Category type '${category.type}' does not match item type '${itemType}'`,
      );
    }
  }

  private static async assertUniqueBarcode(
    barcode: string,
    excludeId?: number,
  ) {
    // Only conflict with active (non-archived) items
    const existing = await prisma.item.findFirst({
      where: { barcode, deletedAt: null },
    });
    if (existing && existing.id !== excludeId) {
      throw new Error(`Barcode '${barcode}' is already in use`);
    }
  }

  private static async assertUniqueInventoryRecord(
    itemName: string,
    categoryId: number,
    itemType: ItemType,
    excludeId?: number,
  ) {
    const normalizedItemName = normalizeDuplicateText(itemName);

    const existing = await prisma.item.findFirst({
      where: {
        deletedAt: null,
        itemName: {
          equals: normalizedItemName,
          mode: 'insensitive',
        },
        categoryId,
        itemType,
        ...(excludeId !== undefined && {
          NOT: { id: excludeId },
        }),
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error(
        'An inventory item with the same name, category, and type already exists.',
      );
    }
  }

  private static async findActiveOrThrow(id: number) {
    const item = await prisma.item.findUnique({
      where: { id },
      include: itemInclude,
    });

    if (!item || item.deletedAt) {
      throw new Error('Item not found');
    }

    return item;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  static async create(data: CreateItemInput, registeredBy: number) {
    const itemName = normalizeDuplicateText(data.itemName);

    await this.assertCategoryMatchesType(data.categoryId, data.itemType);
    await this.assertUniqueInventoryRecord(
      itemName,
      data.categoryId,
      data.itemType,
    );

    if (data.barcode) {
      await this.assertUniqueBarcode(data.barcode);
    }

    // CONSUMABLE
    if (data.itemType === ItemType.CONSUMABLE) {
      return prisma.item.create({
        data: {
          itemName,
          description: data.description ?? null,
          categoryId: data.categoryId,
          itemType: ItemType.CONSUMABLE,
          barcode: data.barcode ?? null,
          imageUrl: data.imageUrl ?? null,
          registeredBy,
          consumableProfile: {
            create: {
              unit: data.consumableProfile.unit,
              quantity: data.consumableProfile.quantity,
              reorderPoint: data.consumableProfile.reorderPoint,
              status: calculateStockStatus(
                data.consumableProfile.quantity,
                data.consumableProfile.reorderPoint,
              ),
            },
          },
        },
        include: itemInclude,
      });
    }

    // DIGITAL
    return prisma.item.create({
      data: {
        itemName,
        description: data.description ?? null,
        categoryId: data.categoryId,
        itemType: ItemType.DIGITAL,
        barcode: data.barcode ?? null,
        imageUrl: data.imageUrl ?? null,
        registeredBy,
        digitalAsset: {
          create: {
            assetType: data.digitalAsset.assetType,
            url: data.digitalAsset.url ?? null,
            vendor: data.digitalAsset.vendor ?? null,
            licenseKey: data.digitalAsset.licenseKey ?? null,
            credentialsRef: data.digitalAsset.credentialsRef ?? null,
            seats: data.digitalAsset.seats ?? null,
            expiryDate: data.digitalAsset.expiryDate ?? null,
            cost:
              data.digitalAsset.cost != null
                ? new Prisma.Decimal(data.digitalAsset.cost)
                : null,
            billingCycle: data.digitalAsset.billingCycle ?? null,
            status: data.digitalAsset.status,
            notes: data.digitalAsset.notes ?? null,
          },
        },
      },
      include: itemInclude,
    });
  }

  static async findAll(query: ListItemsQuery) {
    const { itemType, categoryId, search, page, limit, includeArchived } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ItemWhereInput = {
      // When includeArchived=true return only archived rows; otherwise only active
      ...(includeArchived ? { deletedAt: { not: null } } : { deletedAt: null }),
      ...(itemType && { itemType }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { itemName: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: itemInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.item.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Returns the highest ITM-NNN barcode number across ALL items
   * (active + archived) so the frontend can generate a collision-free code.
   */
  static async findMaxBarcode(): Promise<number> {
    const items = await prisma.item.findMany({
      select: { barcode: true },
      where: { barcode: { startsWith: 'ITM-' } },
    });
    return items.reduce((max, item) => {
      if (!item.barcode) return max;
      const match = item.barcode.match(/^ITM-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
  }

  static async findOne(id: number) {
    return this.findActiveOrThrow(id);
  }

  static async update(id: number, data: UpdateItemInput) {
    const item = await this.findActiveOrThrow(id);

    if (data.categoryId) {
      await this.assertCategoryMatchesType(data.categoryId, item.itemType);
    }

    if (data.barcode !== undefined && data.barcode !== item.barcode) {
      if (data.barcode) {
        await this.assertUniqueBarcode(data.barcode, id);
      }
    }

    const nextItemName =
      data.itemName !== undefined
        ? normalizeDuplicateText(data.itemName)
        : item.itemName;

    const nextCategoryId =
      data.categoryId !== undefined ? data.categoryId : item.categoryId;

    if (data.itemName !== undefined || data.categoryId !== undefined) {
      await this.assertUniqueInventoryRecord(
        nextItemName,
        nextCategoryId,
        item.itemType,
        id,
      );
    }

    const {
      itemName,
      description,
      categoryId,
      barcode,
      imageUrl,
      // consumable fields
      unit,
      quantity,
      reorderPoint,
      // digital fields
      assetType,
      url,
      vendor,
      licenseKey,
      credentialsRef,
      seats,
      expiryDate,
      cost,
      billingCycle,
      status,
      notes,
    } = data;

    return prisma.item.update({
      where: { id },
      data: {
        ...(itemName !== undefined && { itemName: nextItemName }),
        ...(description !== undefined && { description }),
        ...(categoryId !== undefined && { categoryId }),
        ...(barcode !== undefined && { barcode }),
        ...(imageUrl !== undefined && { imageUrl }),

        // Update consumable profile if item is CONSUMABLE
        ...(item.itemType === ItemType.CONSUMABLE &&
          (unit !== undefined ||
            quantity !== undefined ||
            reorderPoint !== undefined) && {
            consumableProfile: {
              update: (() => {
                const existingProfile = item.consumableProfile!;
                const newQuantity =
                  quantity !== undefined ? quantity : existingProfile.quantity;
                const newReorderPoint =
                  reorderPoint !== undefined
                    ? reorderPoint
                    : existingProfile.reorderPoint;

                return {
                  ...(unit !== undefined && { unit }),
                  ...(quantity !== undefined && { quantity }),
                  ...(reorderPoint !== undefined && { reorderPoint }),
                  status: calculateStockStatus(newQuantity, newReorderPoint),
                };
              })(),
            },
          }),

        // Update digital asset if item is DIGITAL
        ...(item.itemType === ItemType.DIGITAL &&
          (assetType !== undefined ||
            url !== undefined ||
            vendor !== undefined ||
            licenseKey !== undefined ||
            credentialsRef !== undefined ||
            seats !== undefined ||
            expiryDate !== undefined ||
            cost !== undefined ||
            billingCycle !== undefined ||
            status !== undefined ||
            notes !== undefined) && {
            digitalAsset: {
              update: {
                ...(assetType !== undefined && { assetType }),
                ...(url !== undefined && { url }),
                ...(vendor !== undefined && { vendor }),
                ...(licenseKey !== undefined && { licenseKey }),
                ...(credentialsRef !== undefined && { credentialsRef }),
                ...(seats !== undefined && { seats }),
                ...(expiryDate !== undefined && { expiryDate }),
                ...(cost !== undefined && {
                  cost: cost != null ? new Prisma.Decimal(cost) : null,
                }),
                ...(billingCycle !== undefined && { billingCycle }),
                ...(status !== undefined && { status }),
                ...(notes !== undefined && { notes }),
              },
            },
          }),
      },
      include: itemInclude,
    });
  }

  static async archive(id: number) {
    const item = await this.findActiveOrThrow(id);

    // Block archiving if item is EQUIPMENT — use DELETE /equipment/:id instead
    if (item.itemType === ItemType.EQUIPMENT) {
      throw new Error('Equipment items must be archived via the equipment API');
    }

    return prisma.item.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
