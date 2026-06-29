import {
  PurchaseOrderStatus,
  Prisma,
  ItemStatus,
  MovementType,
  ItemType,
  ConditionStatus,
  EquipmentStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuditLogService } from './audit-log.service.js';
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderStatusInput,
  AddAttachmentInput,
} from '../schemas/procurement.schema.js';

// ── Allowed status transitions (state machine) ──────────────────────────────
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> =
  {
    DRAFT: ['PENDING'],
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['COMPLETED', 'CANCELLED'],
    REJECTED: [],
    COMPLETED: ['ARCHIVED'],
    CANCELLED: ['ARCHIVED'],
    ARCHIVED: [],
  };

// ── Role checks ──────────────────────────────────────────────────────────────
// Actions that require Manager/Admin role
const ELEVATED_TRANSITIONS: PurchaseOrderStatus[] = [
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
];

const PO_INCLUDE = {
  supplier: {
    select: {
      id: true,
      supplierName: true,
      contactPerson: true,
      email: true,
      phone: true,
      deletedAt: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  lineItems: {
    include: {
      item: {
        select: {
          id: true,
          itemName: true,
          barcode: true,
          itemType: true,
          description: true,
          categoryId: true,
        },
      },
    },
  },
  history: {
    include: {
      changedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  attachments: {
    orderBy: {
      uploadedAt: 'desc' as const,
    },
  },
} as const;

export class ProcurementService {
  // ── Create ───────────────────────────────────────────────────────────────
  static async create(data: CreatePurchaseOrderInput, createdById: number) {
    // Validate supplier exists and is active
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });

    if (!supplier || supplier.deletedAt) {
      throw new Error('Supplier not found or is inactive');
    }

    // Validate all items exist
    const itemIds = data.lineItems.map((li) => li.itemId);
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds }, deletedAt: null },
    });

    if (items.length !== itemIds.length) {
      throw new Error('One or more items not found or have been archived');
    }

    // Check for duplicate item IDs in lineItems
    const uniqueItemIds = new Set(itemIds);
    if (uniqueItemIds.size !== itemIds.length) {
      throw new Error('Duplicate item IDs are not allowed in line items');
    }

    // Calculate total
    const totalAmount = data.lineItems.reduce(
      (sum, li) => sum + li.quantity * li.unitCost,
      0,
    );

    // Create PO with line items in a transaction
    const po = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          supplierId: data.supplierId,
          invoiceNumber: null, // will be set below
          status: 'DRAFT',
          totalAmount,
          createdById,
          lineItems: {
            create: data.lineItems.map((li) => ({
              itemId: li.itemId,
              quantity: li.quantity,
              unitCost: li.unitCost,
            })),
          },
        },
        include: PO_INCLUDE,
      });

      // Auto-generate invoice number: INV-YYYY-NNNN using the PO id
      const year = new Date().getFullYear();
      const invoiceNumber = `INV-${year}-${String(created.id).padStart(4, '0')}`;

      // Update the PO with the generated invoice number
      await tx.purchaseOrder.update({
        where: { id: created.id },
        data: { invoiceNumber },
      });

      // Create initial history entry
      await tx.purchaseOrderHistory.create({
        data: {
          purchaseOrderId: created.id,
          oldStatus: 'DRAFT',
          newStatus: 'DRAFT',
          changedById: createdById,
          notes: 'Purchase order created',
        },
      });

      // Audit log
      await AuditLogService.log(
        'PurchaseOrder',
        created.id,
        'CREATED',
        createdById,
        null,
        created,
        tx,
      );

      return created;
    });

    // Re-fetch to include the history entry and updated invoice number
    return prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: PO_INCLUDE,
    });
  }

  // ── Find All ─────────────────────────────────────────────────────────────
  static async findAll(
    statusFilter?: PurchaseOrderStatus,
    includeArchived: boolean | string = false,
  ) {
    const shouldInclude =
      includeArchived === true || includeArchived === 'true';

    const where: Prisma.PurchaseOrderWhereInput = {};

    if (statusFilter) {
      where.status = statusFilter;
    } else if (!shouldInclude) {
      where.status = { notIn: ['ARCHIVED', 'REJECTED', 'CANCELLED'] };
    }

    return prisma.purchaseOrder.findMany({
      where,
      include: PO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Find One ─────────────────────────────────────────────────────────────
  static async findOne(id: number) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: PO_INCLUDE,
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    return po;
  }

  // ── Update (Draft only) ──────────────────────────────────────────────────
  static async update(
    id: number,
    data: UpdatePurchaseOrderInput,
    userId: number,
  ) {
    const existing = await this.findOne(id);

    if (existing.status !== 'DRAFT') {
      throw new Error('Only purchase orders in DRAFT status can be edited');
    }

    // If changing supplier, validate it
    if (data.supplierId !== undefined) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier || supplier.deletedAt) {
        throw new Error('Supplier not found or is inactive');
      }
    }

    // If updating line items, validate them
    if (data.lineItems) {
      const itemIds = data.lineItems.map((li) => li.itemId);
      const items = await prisma.item.findMany({
        where: { id: { in: itemIds }, deletedAt: null },
      });

      if (items.length !== itemIds.length) {
        throw new Error('One or more items not found or have been archived');
      }

      const uniqueItemIds = new Set(itemIds);
      if (uniqueItemIds.size !== itemIds.length) {
        throw new Error('Duplicate item IDs are not allowed in line items');
      }
    }

    const totalAmount = data.lineItems
      ? data.lineItems.reduce((sum, li) => sum + li.quantity * li.unitCost, 0)
      : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      // If line items are being replaced, delete existing and re-create
      if (data.lineItems) {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      const result = await tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(data.supplierId !== undefined
            ? { supplierId: data.supplierId }
            : {}),
          ...(data.invoiceNumber !== undefined
            ? { invoiceNumber: data.invoiceNumber || null }
            : {}),
          ...(totalAmount !== undefined ? { totalAmount } : {}),
          ...(data.lineItems
            ? {
                lineItems: {
                  create: data.lineItems.map((li) => ({
                    itemId: li.itemId,
                    quantity: li.quantity,
                    unitCost: li.unitCost,
                  })),
                },
              }
            : {}),
        },
        include: PO_INCLUDE,
      });

      // Create history entry for the edit
      await tx.purchaseOrderHistory.create({
        data: {
          purchaseOrderId: id,
          oldStatus: existing.status,
          newStatus: result.status,
          changedById: userId,
          notes: 'Purchase order updated',
        },
      });

      await AuditLogService.log(
        'PurchaseOrder',
        id,
        'UPDATED',
        userId,
        existing,
        result,
        tx,
      );

      return result;
    });

    return updated;
  }

  // ── Update Status ────────────────────────────────────────────────────────
  static async updateStatus(
    id: number,
    data: UpdatePurchaseOrderStatusInput,
    userId: number,
    userRoleId: number,
  ) {
    const existing = await this.findOne(id);
    const currentStatus = existing.status;
    const newStatus = data.status as PurchaseOrderStatus;

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }

    // Check if this transition requires elevated role
    if (ELEVATED_TRANSITIONS.includes(newStatus)) {
      const role = await prisma.role.findUnique({
        where: { id: userRoleId },
      });

      if (!role || !['ADMIN', 'MANAGER'].includes(role.name)) {
        throw new Error(
          'Only Managers or Admins can perform this status change',
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      const hasEquipment = existing.lineItems.some(
        (li) => li.item.itemType === 'EQUIPMENT',
      );
      let statusToSave = newStatus;
      if (newStatus === 'COMPLETED') {
        statusToSave = hasEquipment ? 'COMPLETED' : 'ARCHIVED';
      }

      const result = await tx.purchaseOrder.update({
        where: { id },
        data: { status: statusToSave },
        include: PO_INCLUDE,
      });

      // Create immutable history entry
      if (newStatus === 'COMPLETED') {
        // Log transition from currentStatus to COMPLETED
        await tx.purchaseOrderHistory.create({
          data: {
            purchaseOrderId: id,
            oldStatus: currentStatus,
            newStatus: 'COMPLETED',
            changedById: userId,
            notes: data.notes || 'Order completed',
          },
        });

        if (!hasEquipment) {
          // Log transition from COMPLETED to ARCHIVED (auto-archive)
          await tx.purchaseOrderHistory.create({
            data: {
              purchaseOrderId: id,
              oldStatus: 'COMPLETED',
              newStatus: 'ARCHIVED',
              changedById: userId,
              notes: 'Automatically archived on completion',
            },
          });
        }
      } else {
        await tx.purchaseOrderHistory.create({
          data: {
            purchaseOrderId: id,
            oldStatus: currentStatus,
            newStatus,
            changedById: userId,
            notes: data.notes || null,
          },
        });
      }

      if (newStatus === 'COMPLETED') {
        await AuditLogService.log(
          'PurchaseOrder',
          id,
          'UPDATED',
          userId,
          { status: currentStatus },
          { status: 'COMPLETED' },
          tx,
        );

        if (!hasEquipment) {
          await AuditLogService.log(
            'PurchaseOrder',
            id,
            'UPDATED',
            userId,
            { status: 'COMPLETED' },
            { status: 'ARCHIVED' },
            tx,
          );
        }
      } else {
        await AuditLogService.log(
          'PurchaseOrder',
          id,
          newStatus === 'APPROVED' ? 'APPROVED' : 'UPDATED',
          userId,
          { status: currentStatus },
          { status: newStatus },
          tx,
        );
      }

      // If the status transitions to COMPLETED, auto-update the inventory
      if (newStatus === 'COMPLETED') {
        // Query next asset ID start number
        const equipmentList = await tx.equipment.findMany({
          select: { assetId: true },
          where: { assetId: { startsWith: 'EQ-' } },
        });
        let nextAssetNum =
          equipmentList.reduce((max, eq) => {
            const match = eq.assetId.match(/^EQ-(\d+)$/);
            return match ? Math.max(max, Number(match[1])) : max;
          }, 0) + 1;

        for (const li of existing.lineItems) {
          if (li.item.itemType === 'CONSUMABLE') {
            const profile = await tx.consumableProfile.findUnique({
              where: { itemId: li.itemId },
            });
            if (profile) {
              const quantityBefore = profile.quantity;
              const quantityAfter = quantityBefore + li.quantity;

              // Recalculate status
              let itemStatus = profile.status;
              if (itemStatus !== ItemStatus.ARCHIVED) {
                if (quantityAfter <= 0) {
                  itemStatus = ItemStatus.OUT_OF_STOCK;
                } else if (quantityAfter <= profile.reorderPoint) {
                  itemStatus = ItemStatus.LOW_STOCK;
                } else {
                  itemStatus = ItemStatus.IN_STOCK;
                }
              }

              // Update profile
              await tx.consumableProfile.update({
                where: { id: profile.id },
                data: {
                  quantity: quantityAfter,
                  status: itemStatus,
                },
              });

              // Create StockIn
              const stockIn = await tx.stockIn.create({
                data: {
                  consumableProfileId: profile.id,
                  quantityAdded: li.quantity,
                  purchaseOrderId: id,
                  receivedById: userId,
                  notes: `Received automatically on completion of Purchase Order ${result.invoiceNumber || id}`,
                },
              });

              // Create StockMovement ledger entry
              await tx.stockMovement.create({
                data: {
                  consumableProfileId: profile.id,
                  movementType: MovementType.STOCK_IN,
                  quantityChange: li.quantity,
                  quantityBefore,
                  quantityAfter,
                  reason: `Purchase Order Completed: Received ${li.quantity} units`,
                  referenceType: 'STOCK_IN',
                  referenceId: stockIn.id,
                  performedById: userId,
                },
              });
            }
          } else if (li.item.itemType === 'EQUIPMENT') {
            // Generate individual physical equipment assets
            for (let i = 0; i < li.quantity; i++) {
              const assetId = `EQ-${String(nextAssetNum++).padStart(3, '0')}`;
              await tx.equipment.create({
                data: {
                  assetId,
                  serialNumber: null, // Pending registration/serialization
                  brand: null,
                  model: null,
                  condition: ConditionStatus.NEW,
                  status: EquipmentStatus.AVAILABLE,
                  location: null,
                  purchasePrice: li.unitCost,
                  deletedAt: new Date(),
                  purchaseOrder: {
                    connect: { id },
                  },
                  item: {
                    create: {
                      itemName: li.item.itemName,
                      description: li.item.description || null,
                      categoryId: li.item.categoryId,
                      itemType: ItemType.EQUIPMENT,
                      barcode: null,
                      registeredBy: userId,
                      deletedAt: new Date(),
                    },
                  },
                },
              });
            }
          }
        }
      }

      return result;
    });

    // Re-fetch to include the new history entry
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: PO_INCLUDE,
    });
  }

  // ── History ──────────────────────────────────────────────────────────────
  static async getHistory(id: number) {
    await this.findOne(id);

    return prisma.purchaseOrderHistory.findMany({
      where: { purchaseOrderId: id },
      include: {
        changedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Attachments ──────────────────────────────────────────────────────────
  static async addAttachment(id: number, data: AddAttachmentInput) {
    await this.findOne(id);

    return prisma.purchaseOrderAttachment.create({
      data: {
        purchaseOrderId: id,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize ?? null,
      },
    });
  }

  static async deleteAttachment(poId: number, attachmentId: number) {
    const attachment = await prisma.purchaseOrderAttachment.findFirst({
      where: { id: attachmentId, purchaseOrderId: poId },
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    await prisma.purchaseOrderAttachment.delete({
      where: { id: attachmentId },
    });

    return { message: 'Attachment deleted successfully' };
  }

  // ── Equipment Integration ──────────────────────────────────────────────────
  static async getEquipmentByPO(purchaseOrderId: number) {
    return prisma.equipment.findMany({
      where: {
        purchaseOrderId,
      },
      include: {
        item: {
          select: {
            id: true,
            itemName: true,
            description: true,
            categoryId: true,
            itemType: true,
            barcode: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async updateEquipmentDetails(
    purchaseOrderId: number,
    equipmentId: number,
    data: {
      serialNumber?: string | null;
      location?: string | null;
      brand?: string | null;
      model?: string | null;
      condition?: ConditionStatus;
      warrantyEnd?: string | null;
    },
    userId: number,
  ) {
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        purchaseOrderId,
      },
    });

    if (!equipment) {
      throw new Error('Equipment unit not found for this Purchase Order');
    }

    if (data.serialNumber && data.serialNumber !== equipment.serialNumber) {
      const duplicate = await prisma.equipment.findFirst({
        where: {
          serialNumber: data.serialNumber,
          deletedAt: null,
          id: { not: equipmentId },
        },
      });
      if (duplicate) {
        throw new Error(
          `Serial number "${data.serialNumber}" is already registered to another asset.`,
        );
      }
    }

    const updatedEquipment = await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        serialNumber: data.serialNumber || null,
        location: data.location || null,
        brand: data.brand || null,
        model: data.model || null,
        condition: data.condition || undefined,
        warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : null,
        deletedAt: null,
        item: {
          update: {
            deletedAt: null,
          },
        },
      },
      include: {
        item: true,
      },
    });

    // Check if all units under this PO are now registered
    const unregisteredCount = await prisma.equipment.count({
      where: {
        purchaseOrderId,
        deletedAt: { not: null },
      },
    });

    if (unregisteredCount === 0) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
      });
      if (po && po.status === 'COMPLETED') {
        await prisma.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: { status: 'ARCHIVED' },
        });

        await prisma.purchaseOrderHistory.create({
          data: {
            purchaseOrderId,
            oldStatus: 'COMPLETED',
            newStatus: 'ARCHIVED',
            changedById: userId,
            notes:
              'Automatically archived after registering all equipment assets',
          },
        });

        await AuditLogService.log(
          'PurchaseOrder',
          purchaseOrderId,
          'UPDATED',
          userId,
          { status: 'COMPLETED' },
          { status: 'ARCHIVED' },
        );
      }
    }

    return updatedEquipment;
  }
}
