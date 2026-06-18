import { prisma } from '../lib/prisma.js';
import { AuditLogService } from './audit-log.service.js';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
} from '../schemas/suppliers.schema.js';

const SUPPLIER_INCLUDE = {
  _count: {
    select: {
      purchaseOrders: true,
    },
  },
} as const;

export class SuppliersService {
  static async create(data: CreateSupplierInput, performedById: number) {
    const existing = await prisma.supplier.findFirst({
      where: {
        supplierName: {
          equals: data.supplierName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new Error('Supplier name already exists');
    }

    const supplier = await prisma.supplier.create({
      data: {
        supplierName: data.supplierName,
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
      },
      include: SUPPLIER_INCLUDE,
    });

    await AuditLogService.log(
      'Supplier',
      supplier.id,
      'CREATED',
      performedById,
      null,
      supplier,
    );

    return supplier;
  }

  static async findAll(includeArchived: boolean | string = false) {
    const shouldInclude =
      includeArchived === true || includeArchived === 'true';
    return prisma.supplier.findMany({
      where: shouldInclude ? {} : { deletedAt: null },
      orderBy: { supplierName: 'asc' },
      include: SUPPLIER_INCLUDE,
    });
  }

  static async findOne(id: number) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: SUPPLIER_INCLUDE,
    });

    if (!supplier || supplier.deletedAt) {
      throw new Error('Supplier not found');
    }

    return supplier;
  }

  static async update(
    id: number,
    data: UpdateSupplierInput,
    performedById: number,
  ) {
    const oldSupplier = await this.findOne(id);

    if (data.supplierName) {
      const existing = await prisma.supplier.findFirst({
        where: {
          supplierName: {
            equals: data.supplierName,
            mode: 'insensitive',
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new Error('Supplier name already exists');
      }
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        supplierName: data.supplierName,
        contactPerson:
          data.contactPerson !== undefined
            ? data.contactPerson || null
            : undefined,
        email: data.email !== undefined ? data.email || null : undefined,
        phone: data.phone !== undefined ? data.phone || null : undefined,
        address: data.address !== undefined ? data.address || null : undefined,
      },
      include: SUPPLIER_INCLUDE,
    });

    await AuditLogService.log(
      'Supplier',
      id,
      'UPDATED',
      performedById,
      oldSupplier,
      updated,
    );

    return updated;
  }

  static async archive(id: number, performedById: number) {
    const oldSupplier = await this.findOne(id);

    const archived = await prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: SUPPLIER_INCLUDE,
    });

    await AuditLogService.log(
      'Supplier',
      id,
      'DELETED',
      performedById,
      oldSupplier,
      archived,
    );

    return archived;
  }

  static async getHistory(id: number) {
    // Check if supplier exists (throws error if not found/archived)
    await this.findOne(id);

    const logs = await prisma.inventoryLog.findMany({
      where: {
        entityType: 'Supplier',
        entityId: id,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        performedAt: 'desc',
      },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      performedBy: `${log.user.firstName} ${log.user.lastName}`,
      performedAt: log.performedAt,
      oldData: log.oldData,
      newData: log.newData,
    }));
  }
}
