import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuditLogService } from './audit-log.service.js';
import {
  CreateSupplierInput,
  ListSuppliersQuery,
  UpdateSupplierInput,
} from '../schemas/suppliers.schema.js';

const SUPPLIER_INCLUDE = {
  _count: {
    select: {
      purchaseOrders: true,
    },
  },
} as const;

type SupplierWithCount = Prisma.SupplierGetPayload<{
  include: typeof SUPPLIER_INCLUDE;
}>;

function mapSupplier(supplier: SupplierWithCount) {
  return {
    id: supplier.id,
    supplierName: supplier.supplierName,
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    deletedAt: supplier.deletedAt,
    status: supplier.deletedAt ? 'inactive' : 'active',
    purchaseOrderCount: supplier._count.purchaseOrders,
  };
}

function buildSupplierStatusWhere(
  status: ListSuppliersQuery['status'] = 'active',
): Prisma.SupplierWhereInput {
  if (status === 'active') {
    return { deletedAt: null };
  }

  if (status === 'inactive') {
    return { deletedAt: { not: null } };
  }

  return {};
}

function buildSupplierSearchWhere(search = ''): Prisma.SupplierWhereInput {
  const trimmedSearch = search.trim();

  if (!trimmedSearch) {
    return {};
  }

  return {
    OR: [
      {
        supplierName: {
          contains: trimmedSearch,
          mode: 'insensitive',
        },
      },
      {
        contactPerson: {
          contains: trimmedSearch,
          mode: 'insensitive',
        },
      },
      {
        email: {
          contains: trimmedSearch,
          mode: 'insensitive',
        },
      },
      {
        phone: {
          contains: trimmedSearch,
          mode: 'insensitive',
        },
      },
      {
        address: {
          contains: trimmedSearch,
          mode: 'insensitive',
        },
      },
    ],
  };
}

export class SuppliersService {
  static async create(data: CreateSupplierInput, performedById: number) {
    const existing = await prisma.supplier.findFirst({
      where: {
        supplierName: {
          equals: data.supplierName,
          mode: 'insensitive',
        },
        deletedAt: null,
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

  static async findAll(query: ListSuppliersQuery) {
    if (query.includeArchived) {
      const suppliers = await prisma.supplier.findMany({
        where: {},
        orderBy: {
          supplierName: 'asc',
        },
        include: SUPPLIER_INCLUDE,
      });

      return suppliers.map(mapSupplier);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      AND: [
        buildSupplierStatusWhere(query.status),
        buildSupplierSearchWhere(query.search),
      ],
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: {
          supplierName: 'asc',
        },
        skip,
        take: limit,
        include: SUPPLIER_INCLUDE,
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers.map(mapSupplier),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async findOne(id: number, includeArchived = false) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: SUPPLIER_INCLUDE,
    });

    if (!supplier || (!includeArchived && supplier.deletedAt)) {
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
          deletedAt: null,
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

  static async restore(id: number, performedById: number) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: SUPPLIER_INCLUDE,
    });

    if (!supplier || !supplier.deletedAt) {
      throw new Error('Archived supplier not found');
    }

    const duplicate = await prisma.supplier.findFirst({
      where: {
        supplierName: {
          equals: supplier.supplierName,
          mode: 'insensitive',
        },
        deletedAt: null,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new Error(
        `Cannot restore: an active supplier with the name "${duplicate.supplierName}" already exists`,
      );
    }

    const restored = await prisma.supplier.update({
      where: { id },
      data: { deletedAt: null },
      include: SUPPLIER_INCLUDE,
    });

    await AuditLogService.log(
      'Supplier',
      id,
      'CREATED',
      performedById,
      supplier,
      restored,
    );

    return restored;
  }

  static async getHistory(id: number) {
    await this.findOne(id, true);

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
