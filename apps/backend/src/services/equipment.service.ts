import { prisma } from '../lib/prisma.js';
import {
  BorrowStatus,
  ConditionStatus,
  EquipmentStatus,
  ItemType,
  Prisma,
  LogAction,
  DisposalApprovalStatus,
  DisposalReason,
  MaintenanceStatus,
} from '@prisma/client';
import { AuditLogService } from './audit-log.service.js';
import type {
  CreateEquipmentInput,
  UpdateEquipmentInput,
  EquipmentImageInput,
  UpdateImageInput,
  ListEquipmentQuery,
  RetirementRequestInput,
  UpdateDisposalApprovalInput,
  ReplacementNeededInput,
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

const retirementEligibleConditions = new Set<ConditionStatus>([
  ConditionStatus.FAIR,
  ConditionStatus.POOR,
  ConditionStatus.DAMAGED,
]);

const EQUIPMENT_LIFECYCLE_YEARS = 5;

function getRejectedRetirementFallbackStatus(disposalReason: {
  reason: DisposalReason;
  equipment: {
    status: EquipmentStatus;
    condition: ConditionStatus;
  };
}) {
  if (disposalReason.equipment.status !== EquipmentStatus.RETIREMENT_PENDING) {
    return disposalReason.equipment.status;
  }

  if (
    disposalReason.reason === DisposalReason.LOST ||
    disposalReason.reason === DisposalReason.STOLEN
  ) {
    return EquipmentStatus.LOST;
  }

  if (
    disposalReason.reason === DisposalReason.DAMAGED_BEYOND_REPAIR ||
    disposalReason.equipment.condition === ConditionStatus.DAMAGED
  ) {
    return EquipmentStatus.DAMAGED;
  }

  return EquipmentStatus.AVAILABLE;
}

function startOfDay(date: Date) {
  return new Date(date.toLocaleDateString('sv-SE'));
}

function addCalendarYears(date: Date, years: number) {
  const result = startOfDay(date);
  result.setFullYear(result.getFullYear() + years);

  return result;
}

function hasExceededLifecycle(
  acquisitionDate: Date | string | null | undefined,
) {
  if (!acquisitionDate) return false;

  const parsedDate =
    acquisitionDate instanceof Date
      ? acquisitionDate
      : new Date(acquisitionDate);

  if (Number.isNaN(parsedDate.getTime())) return false;

  const replacementDate = addCalendarYears(
    parsedDate,
    EQUIPMENT_LIFECYCLE_YEARS,
  );

  return startOfDay(new Date()) >= replacementDate;
}

function getRetirementEligibilityError(equipment: {
  status: EquipmentStatus;
  condition: ConditionStatus;
  replacementNeeded?: boolean | null;
  acquisitionDate?: Date | string | null;
}) {
  if (equipment.status === EquipmentStatus.BORROWED) {
    return 'Equipment is currently borrowed and cannot be retired';
  }

  if (equipment.status === EquipmentStatus.IN_USE) {
    return 'Equipment is currently in use and cannot be retired';
  }

  if (equipment.status === EquipmentStatus.RETIREMENT_PENDING) {
    return 'Equipment already has a retirement request';
  }

  if (equipment.status === EquipmentStatus.RETIRED) {
    return 'Equipment is already retired';
  }

  const hasRetirementStatus =
    equipment.status === EquipmentStatus.DAMAGED ||
    equipment.status === EquipmentStatus.LOST;
  const hasRetirementCondition = retirementEligibleConditions.has(
    equipment.condition,
  );
  const hasManualReplacementTag = Boolean(equipment.replacementNeeded);
  const hasLifecycleExceeded = hasExceededLifecycle(equipment.acquisitionDate);

  if (
    !hasRetirementStatus &&
    !hasRetirementCondition &&
    !hasManualReplacementTag &&
    !hasLifecycleExceeded
  ) {
    return 'Equipment cannot be retired unless it has a replacement, lifecycle, damaged, lost, fair, or poor indicator';
  }

  return null;
}

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
    const existing = await prisma.equipment.findUnique({
      where: { assetId },
    });

    if (existing && existing.id !== excludeId) {
      throw new Error(`Asset ID '${assetId}' is already in use`);
    }
  }

  private static async assertUniqueSerialNumber(
    serialNumber: string,
    excludeId?: number,
  ) {
    const existing = await prisma.equipment.findFirst({
      where: {
        serialNumber: {
          equals: serialNumber,
          mode: 'insensitive',
        },
      },
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

  private static async syncCompletedRetirements() {
    const completedRetirements = await prisma.disposal.findMany({
      where: {
        approvalStatus: DisposalApprovalStatus.COMPLETED,
        equipment: {
          status: EquipmentStatus.RETIREMENT_PENDING,
          deletedAt: null,
        },
      },
      select: {
        equipmentId: true,
      },
    });

    const equipmentIds = completedRetirements.map(
      (record) => record.equipmentId,
    );

    if (equipmentIds.length === 0) {
      return;
    }

    await prisma.equipment.updateMany({
      where: {
        id: { in: equipmentIds },
        status: EquipmentStatus.RETIREMENT_PENDING,
        deletedAt: null,
      },
      data: {
        status: EquipmentStatus.RETIRED,
      },
    });
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  static async create(data: CreateEquipmentInput, registeredBy: number) {
    await this.assertCategoryIsEquipment(data.categoryId);
    await this.assertUniqueAssetId(data.assetId);

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
        where: {
          id: data.assignedTo,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!user) {
        throw new Error('Assigned user not found or inactive');
      }
    }

    if (data.purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
      });

      if (!po) {
        throw new Error('Purchase order not found');
      }
    }

    try {
      const equipment = await prisma.$transaction(async (tx) => {
        const eq = await tx.equipment.create({
          data: {
            assetId: data.assetId,
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

        // Automatically create an initial unscheduled maintenance log only if the equipment
        // is registered in non-healthy conditions (FAIR, POOR, DAMAGED).
        if (
          eq.condition !== ConditionStatus.NEW &&
          eq.condition !== ConditionStatus.GOOD
        ) {
          await tx.maintenanceLog.create({
            data: {
              equipmentId: eq.id,
              description:
                'Initial maintenance record — No Maintenance Scheduled',
              status: MaintenanceStatus.SCHEDULED,
              scheduledDate: null,
              equipmentName: eq.item?.itemName ?? data.itemName,
              equipmentBrand: eq.brand,
              equipmentModel: eq.model,
              equipmentCondition: eq.condition,
            },
          });
        }

        await AuditLogService.log(
          'Equipment',
          eq.id,
          LogAction.CREATED,
          registeredBy,
          null,
          eq,
          tx,
        );

        return eq;
      });

      return equipment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target as string[] | undefined;

        if (
          target?.includes('asset_id') ||
          target?.includes('assetId') ||
          target?.some((field) => field.includes('asset_id'))
        ) {
          throw new Error('Asset ID is already in use');
        }

        if (
          target?.includes('serial_number') ||
          target?.includes('serialNumber') ||
          target?.some((field) => field.includes('serial_number'))
        ) {
          throw new Error('Serial number is already in use');
        }
      }

      throw error;
    }
  }

  static async findAll(
    query: Partial<ListEquipmentQuery> & { needsMaintenance?: boolean },
  ) {
    await this.syncCompletedRetirements();

    const {
      status,
      condition,
      categoryId,
      assignedTo,
      search,
      page = 1,
      limit = 20,
      needsMaintenance,
    } = query;

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
      ...(needsMaintenance && {
        condition: {
          in: [
            ConditionStatus.FAIR,
            ConditionStatus.POOR,
            ConditionStatus.DAMAGED,
          ],
        },
        status: {
          notIn: [EquipmentStatus.RETIRED, EquipmentStatus.RETIREMENT_PENDING],
        },
        maintenanceLogs: {
          none: {
            status: {
              in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS],
            },
          },
        },
      }),
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
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async findOne(id: number) {
    return this.findActiveOrThrow(id);
  }

  static async update(id: number, data: UpdateEquipmentInput, userId: number) {
    const equipment = await this.findActiveOrThrow(id);

    if (data.categoryId) {
      await this.assertCategoryIsEquipment(data.categoryId);
    }

    if (
      data.serialNumber &&
      data.serialNumber.toLowerCase() !==
        (equipment.serialNumber ?? '').toLowerCase()
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
        where: {
          id: data.assignedTo,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!user) {
        throw new Error('Assigned user not found or inactive');
      }
    }

    if (data.purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
      });

      if (!po) {
        throw new Error('Purchase order not found');
      }
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

    const updated = await prisma.equipment.update({
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

    await AuditLogService.log(
      'Equipment',
      updated.id,
      LogAction.UPDATED,
      userId,
      equipment,
      updated,
    );

    return updated;
  }

  // ── Replacement needed tagging ──────────────────────────────────────────────

  static async setReplacementNeeded(
    id: number,
    data: ReplacementNeededInput,
    userId: number,
  ) {
    const equipment = await this.findActiveOrThrow(id);

    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        replacementNeeded: data.replacementNeeded,
        replacementNeededAt: data.replacementNeeded ? new Date() : null,
      },
      include: equipmentInclude,
    });

    await AuditLogService.log(
      'Equipment',
      updated.id,
      LogAction.UPDATED,
      userId,
      equipment,
      updated,
    );

    return updated;
  }

  // ── Retirement request ──────────────────────────────────────────────────────

  static async submitRetirementRequest(
    id: number,
    data: RetirementRequestInput,
    requestedById: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const equipment = await tx.equipment.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          condition: true,
          acquisitionDate: true,
          replacementNeeded: true,
          deletedAt: true,
        },
      });

      if (!equipment || equipment.deletedAt) {
        throw new Error('Equipment not found');
      }

      const eligibilityError = getRetirementEligibilityError(equipment);

      if (eligibilityError) {
        throw new Error(eligibilityError);
      }

      const activeBorrowRecord = await tx.borrowRecord.findFirst({
        where: {
          equipmentId: id,
          status: {
            in: [BorrowStatus.BORROWED, BorrowStatus.OVERDUE],
          },
        },
        select: { id: true },
      });

      if (activeBorrowRecord) {
        throw new Error(
          'Equipment is currently borrowed and cannot be retired',
        );
      }

      const existingDisposal = await tx.disposal.findUnique({
        where: { equipmentId: id },
        select: {
          id: true,
          approvalStatus: true,
          reason: true,
          method: true,
          notes: true,
          disposalDate: true,
        },
      });

      if (existingDisposal?.approvalStatus === DisposalApprovalStatus.PENDING) {
        throw new Error('Equipment already has a pending disposal request');
      }

      if (
        existingDisposal?.approvalStatus === DisposalApprovalStatus.COMPLETED
      ) {
        throw new Error('Equipment already has a completed disposal record');
      }

      const disposal = existingDisposal
        ? await tx.disposal.update({
            where: { id: existingDisposal.id },
            data: {
              approvedById: requestedById,
              reason: data.reason,
              approvalStatus: DisposalApprovalStatus.PENDING,
              method: data.method,
              notes: data.notes ?? null,
              disposalDate: new Date(),
            },
          })
        : await tx.disposal.create({
            data: {
              equipmentId: id,
              approvedById: requestedById,
              reason: data.reason,
              approvalStatus: DisposalApprovalStatus.PENDING,
              method: data.method,
              notes: data.notes ?? null,
            },
          });

      const updatedEquipment = await tx.equipment.update({
        where: { id },
        data: {
          status: EquipmentStatus.RETIREMENT_PENDING,
        },
        include: equipmentInclude,
      });

      await AuditLogService.log(
        'Equipment',
        updatedEquipment.id,
        LogAction.UPDATED,
        requestedById,
        equipment,
        updatedEquipment,
        tx,
      );

      await AuditLogService.log(
        'Disposal',
        disposal.id,
        existingDisposal ? LogAction.UPDATED : LogAction.CREATED,
        requestedById,
        existingDisposal ?? null,
        disposal,
        tx,
      );

      return {
        message: 'Equipment retirement request submitted successfully',
        equipment: updatedEquipment,
        disposal,
      };
    });
  }

  static async getDisposalHistory() {
    await this.syncCompletedRetirements();

    return prisma.disposal.findMany({
      orderBy: [
        { approvalStatus: 'asc' },
        { disposalDate: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        equipment: {
          include: {
            item: {
              select: {
                id: true,
                itemName: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  static async updateDisposalApproval(
    id: number,
    data: UpdateDisposalApprovalInput,
    userId: number,
  ) {
    const { approvalStatus } = data;

    return prisma.$transaction(async (tx) => {
      const disposal = await tx.disposal.findUnique({
        where: { id },
        include: {
          equipment: {
            select: {
              id: true,
              status: true,
              condition: true,
              deletedAt: true,
            },
          },
        },
      });

      if (!disposal || disposal.equipment.deletedAt) {
        throw new Error('Disposal record not found');
      }

      if (disposal.approvalStatus !== DisposalApprovalStatus.PENDING) {
        throw new Error(
          'Only pending disposal records can be completed or rejected',
        );
      }

      const nextEquipmentStatus =
        approvalStatus === DisposalApprovalStatus.COMPLETED
          ? EquipmentStatus.RETIRED
          : getRejectedRetirementFallbackStatus(disposal);

      const updatedDisposal = await tx.disposal.update({
        where: { id },
        data: {
          approvalStatus,
          approvedById: userId,
          disposalDate: new Date(),
        },
        include: {
          equipment: {
            include: {
              item: {
                select: {
                  id: true,
                  itemName: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                      type: true,
                    },
                  },
                },
              },
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      const updatedEquipment = await tx.equipment.update({
        where: { id: disposal.equipmentId },
        data: {
          status: nextEquipmentStatus,
        },
        include: equipmentInclude,
      });

      await AuditLogService.log(
        'Disposal',
        updatedDisposal.id,
        LogAction.UPDATED,
        userId,
        disposal,
        updatedDisposal,
        tx,
      );

      await AuditLogService.log(
        'Equipment',
        updatedEquipment.id,
        LogAction.UPDATED,
        userId,
        disposal.equipment,
        updatedEquipment,
        tx,
      );

      return updatedDisposal;
    });
  }

  static async softDelete(id: number, userId: number) {
    const equipment = await this.findActiveOrThrow(id);

    const deletedAt = new Date();

    const deleted = await prisma.equipment.update({
      where: { id },
      data: {
        deletedAt,
        item: {
          update: { deletedAt },
        },
      },
      include: equipmentInclude,
    });

    await AuditLogService.log(
      'Equipment',
      deleted.id,
      LogAction.DELETED,
      userId,
      equipment,
      deleted,
    );

    return deleted;
  }

  // ── Image management ────────────────────────────────────────────────────────

  static async addImage(equipmentId: number, data: EquipmentImageInput) {
    await this.findActiveOrThrow(equipmentId);

    if (data.isPrimary) {
      await prisma.equipmentImage.updateMany({
        where: {
          equipmentId,
          isPrimary: true,
          deletedAt: null,
        },
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
      where: {
        id: imageId,
        equipmentId,
        deletedAt: null,
      },
    });

    if (!image) {
      throw new Error('Image not found');
    }

    if (data.isPrimary) {
      await prisma.equipmentImage.updateMany({
        where: {
          equipmentId,
          isPrimary: true,
          deletedAt: null,
        },
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
      where: {
        id: imageId,
        equipmentId,
        deletedAt: null,
      },
    });

    if (!image) {
      throw new Error('Image not found');
    }

    await prisma.equipmentImage.update({
      where: { id: imageId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Image soft deleted successfully' };
  }
}
