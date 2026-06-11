import { prisma } from '../lib/prisma.js';
import { ItemType, Prisma } from '@prisma/client';
import type {
  CreateEquipmentInput,
  UpdateEquipmentInput,
  EquipmentImageInput,
  UpdateImageInput,
  ListEquipmentQuery,
} from '../schemas/equipment.schema.js';

// ── Shared include ────────────────────────────────────────────────────────────

const equipmentInclude = Prisma.validator<Prisma.EquipmentInclude>()({
  item: {
    select: {
      id: true,
      itemName: true,
      description: true,
      categoryId: true,
      itemType: true,
      barcode: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true, type: true } },
    },
  },
  assignedToUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  purchaseOrder: {
    select: { id: true, invoiceNumber: true, orderDate: true },
  },
  images: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'asc' }],
  },
});

// ── Service ───────────────────────────────────────────────────────────────────

export class EquipmentService {
  // ── Guards ──────────────────────────────────────────────────────────────────

  private static async assertCategoryIsEquipment(categoryId: number) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.deletedAt) {
      throw new Error('Category not found');
    }
    if (category.type !== ItemType.EQUIPMENT) {
      throw new Error('Category must be of type EQUIPMENT');
    }
  }

  private static async assertUniqueAssetId(
    assetId: string,
    excludeId?: number,
  ) {
    const existing = await prisma.equipment.findUnique({ where: { assetId } });
    if (existing && existing.id !== excludeId) {
      throw new Error(`Asset ID '${assetId}' is already in use`);
    }
  }

  /**
   * Generates a unique Asset ID in the format EQ-YYYYMMDD-XXXXX.
   * Retries up to 5 times in the unlikely event of a collision.
   */
  static async generateUniqueAssetId(): Promise<string> {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous chars
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const datePart = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
      const randomPart = Array.from({ length: 5 }, () =>
        CHARS[Math.floor(Math.random() * CHARS.length)],
      ).join('');
      const assetId = `EQ-${datePart}-${randomPart}`;

      const existing = await prisma.equipment.findUnique({ where: { assetId } });
      if (!existing) return assetId;
    }

    throw new Error('Failed to generate a unique Asset ID after multiple attempts');
  }

  private static async assertUniqueSerialNumber(
    serialNumber: string,
    excludeId?: number,
  ) {
    // Case-insensitive lookup: treat 'SN-ABC-123' and 'sn-abc-123' as duplicates
    const existing = await prisma.equipment.findFirst({
      where: { serialNumber: { equals: serialNumber, mode: 'insensitive' } },
    });
    if (existing && existing.id !== excludeId) {
      throw new Error('Serial number already exists');
    }
  }

  private static async findActiveOrThrow(id: number) {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: equipmentInclude,
    });
    if (!equipment || equipment.deletedAt) {
      throw new Error('Equipment not found');
    }
    return equipment;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  static async create(data: CreateEquipmentInput, registeredBy: number) {
    await this.assertCategoryIsEquipment(data.categoryId);

    // Auto-generate Asset ID — system always assigns it on create
    const assetId = await this.generateUniqueAssetId();

    if (data.serialNumber) {
      await this.assertUniqueSerialNumber(data.serialNumber);
    }

    if (data.barcode) {
      const existingBarcode = await prisma.item.findUnique({
        where: { barcode: data.barcode },
      });
      if (existingBarcode) {
        throw new Error(`Barcode '${data.barcode}' is already in use`);
      }
    }

    if (data.assignedTo) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedTo, isActive: true, deletedAt: null },
      });
      if (!user) throw new Error('Assigned user not found or inactive');
    }

    if (data.purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
      });
      if (!po) throw new Error('Purchase order not found');
    }

    return prisma.equipment.create({
      data: {
        assetId,
        serialNumber: data.serialNumber ?? null,
        brand: data.brand ?? null,
        model: data.model ?? null,
        condition: data.condition,
        status: data.status,
        location: data.location ?? null,
        acquisitionDate: data.acquisitionDate ?? null,
        purchasePrice:
          data.purchasePrice != null
            ? new Prisma.Decimal(data.purchasePrice)
            : null,
        warrantyStart: data.warrantyStart ?? null,
        warrantyEnd: data.warrantyEnd ?? null,
        warrantyProvider: data.warrantyProvider ?? null,
        warrantyDocUrl: data.warrantyDocUrl ?? null,
        ...(data.assignedTo != null && {
          assignedToUser: { connect: { id: data.assignedTo } },
        }),
        ...(data.purchaseOrderId != null && {
          purchaseOrder: { connect: { id: data.purchaseOrderId } },
        }),
        item: {
          create: {
            itemName: data.itemName,
            description: data.description ?? null,
            categoryId: data.categoryId,
            itemType: ItemType.EQUIPMENT,
            barcode: data.barcode ?? null,
            registeredBy,
          },
        },
        images: data.images.length
          ? {
              create: data.images.map((img) => ({
                url: img.url,
                label: img.label ?? null,
                isPrimary: img.isPrimary,
              })),
            }
          : undefined,
      },
      include: equipmentInclude,
    });
  }

  static async findAll(query: ListEquipmentQuery) {
    const { status, condition, categoryId, assignedTo, search, page, limit } =
      query;
    const skip = (page - 1) * limit;

    const where: Prisma.EquipmentWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(condition && { condition }),
      ...(assignedTo && { assignedTo }),
      item: {
        deletedAt: null,
        ...(categoryId && { categoryId }),
      },
      ...(search && {
        OR: [
          { assetId: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          {
            item: {
              OR: [
                { itemName: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: equipmentInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.equipment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async findOne(id: number) {
    return this.findActiveOrThrow(id);
  }

  static async update(id: number, data: UpdateEquipmentInput) {
    const equipment = await this.findActiveOrThrow(id);

    if (data.categoryId) {
      await this.assertCategoryIsEquipment(data.categoryId);
    }


    if (
      data.serialNumber &&
      data.serialNumber.toLowerCase() !== (equipment.serialNumber ?? '').toLowerCase()
    ) {
      await this.assertUniqueSerialNumber(data.serialNumber, id);
    }

    if (data.barcode !== undefined && data.barcode !== equipment.item.barcode) {
      if (data.barcode) {
        const existingBarcode = await prisma.item.findUnique({
          where: { barcode: data.barcode },
        });
        if (existingBarcode) {
          throw new Error(`Barcode '${data.barcode}' is already in use`);
        }
      }
    }

    if (data.assignedTo) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedTo, isActive: true, deletedAt: null },
      });
      if (!user) throw new Error('Assigned user not found or inactive');
    }

    if (data.purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
      });
      if (!po) throw new Error('Purchase order not found');
    }

    const {
      itemName,
      description,
      categoryId,
      barcode,
      assignedTo,
      purchasePrice,
      purchaseOrderId,
      ...equipmentFields
    } = data;

    return prisma.equipment.update({
      where: { id },
      data: {
        ...equipmentFields,
        ...(purchasePrice !== undefined && {
          purchasePrice:
            purchasePrice != null ? new Prisma.Decimal(purchasePrice) : null,
        }),
        ...(assignedTo !== undefined && {
          assignedToUser:
            assignedTo != null
              ? { connect: { id: assignedTo } }
              : { disconnect: true },
        }),
        ...(purchaseOrderId !== undefined && {
          purchaseOrder:
            purchaseOrderId != null
              ? { connect: { id: purchaseOrderId } }
              : { disconnect: true },
        }),
        item: {
          update: {
            ...(itemName !== undefined && { itemName }),
            ...(description !== undefined && { description }),
            ...(categoryId !== undefined && { categoryId }),
            ...(barcode !== undefined && { barcode }),
          },
        },
      },
      include: equipmentInclude,
    });
  }

  static async softDelete(id: number) {
    await this.findActiveOrThrow(id);

    return prisma.equipment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        item: { update: { deletedAt: new Date() } },
      },
      include: equipmentInclude,
    });
  }

  // ── Image management ────────────────────────────────────────────────────────

  static async addImage(equipmentId: number, data: EquipmentImageInput) {
    await this.findActiveOrThrow(equipmentId);

    if (data.isPrimary) {
      await prisma.equipmentImage.updateMany({
        where: { equipmentId, isPrimary: true, deletedAt: null },
        data: { isPrimary: false },
      });
    }

    return prisma.equipmentImage.create({
      data: {
        equipmentId,
        url: data.url,
        label: data.label ?? null,
        isPrimary: data.isPrimary,
      },
    });
  }

  static async updateImage(
    equipmentId: number,
    imageId: number,
    data: UpdateImageInput,
  ) {
    await this.findActiveOrThrow(equipmentId);

    const image = await prisma.equipmentImage.findFirst({
      where: { id: imageId, equipmentId, deletedAt: null },
    });
    if (!image) throw new Error('Image not found');

    if (data.isPrimary) {
      await prisma.equipmentImage.updateMany({
        where: { equipmentId, isPrimary: true, deletedAt: null },
        data: { isPrimary: false },
      });
    }

    return prisma.equipmentImage.update({
      where: { id: imageId },
      data,
    });
  }

  static async deleteImage(equipmentId: number, imageId: number) {
    await this.findActiveOrThrow(equipmentId);

    const image = await prisma.equipmentImage.findFirst({
      where: { id: imageId, equipmentId, deletedAt: null },
    });
    if (!image) throw new Error('Image not found');

    await prisma.equipmentImage.update({
      where: { id: imageId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Image soft deleted successfully' };
  }
}
