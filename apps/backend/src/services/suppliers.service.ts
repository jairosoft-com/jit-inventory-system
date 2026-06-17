import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { ListSuppliersQuery } from '../schemas/suppliers.schema.js';

function buildSupplierStatusWhere(
  status: ListSuppliersQuery['status'],
): Prisma.SupplierWhereInput {
  if (status === 'active') {
    return { deletedAt: null };
  }

  if (status === 'inactive') {
    return { deletedAt: { not: null } };
  }

  return {};
}

function buildSupplierSearchWhere(search: string): Prisma.SupplierWhereInput {
  const trimmedSearch = search.trim();

  if (!trimmedSearch) {
    return {};
  }

  return {
    supplierName: {
      contains: trimmedSearch,
      mode: 'insensitive',
    },
  };
}

export class SuppliersService {
  static async findAll(query: ListSuppliersQuery) {
    const page = query.page;
    const limit = query.limit;
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
        include: {
          _count: {
            select: {
              purchaseOrders: true,
            },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers.map((supplier) => ({
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
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
