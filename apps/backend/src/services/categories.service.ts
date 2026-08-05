import { LogAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/categories.schema.js';
import { AuditLogService } from './audit-log.service.js';

const CATEGORY_INCLUDE = {
  _count: {
    select: {
      items: {
        where: { deletedAt: null },
      },
    },
  },
} as const;

// Seed/CLI callers that have no HTTP user context pass undefined;
// audit logging is skipped in that case (seed data is not user activity).
export class CategoriesService {
  static async create(data: CreateCategoryInput, performedById?: number) {
    const existing = await prisma.category.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new Error('Category already exists');
    }

    return prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: data.name,
          type: data.type,
          description: data.description,
        },
        include: CATEGORY_INCLUDE,
      });

      if (performedById) {
        await AuditLogService.log(
          'Category',
          category.id,
          LogAction.CREATED,
          performedById,
          null,
          { name: category.name, type: category.type, description: category.description },
          tx,
        );
      }

      return category;
    });
  }

  static async findAll(includeArchived: boolean | string = false) {
    const shouldInclude =
      includeArchived === true || includeArchived === 'true';

    return prisma.category.findMany({
      where: shouldInclude ? undefined : { deletedAt: null },
      include: CATEGORY_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  static async findOne(id: number) {
    const category = await prisma.category.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: CATEGORY_INCLUDE,
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  static async update(id: number, data: UpdateCategoryInput, performedById?: number) {
    const current = await this.findOne(id);

    if (data.name) {
      const existing = await prisma.category.findFirst({
        where: {
          name: {
            equals: data.name,
            mode: 'insensitive',
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new Error('Category name already exists');
      }
    }

    if (data.type && data.type !== current.type) {
      const activeItemsCount = await prisma.item.count({
        where: {
          categoryId: id,
          deletedAt: null,
        },
      });

      if (activeItemsCount > 0) {
        throw new Error(
          'Cannot change category type when active items are linked',
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: {
          name: data.name,
          type: data.type,
          description: data.description,
        },
        include: CATEGORY_INCLUDE,
      });

      if (performedById) {
        await AuditLogService.log(
          'Category',
          id,
          LogAction.UPDATED,
          performedById,
          { name: current.name, type: current.type, description: current.description },
          { name: updated.name, type: updated.type, description: updated.description },
          tx,
        );
      }

      return updated;
    });
  }

  static async archive(id: number, performedById?: number) {
    const current = await this.findOne(id);

    const activeItemsCount = await prisma.item.count({
      where: {
        categoryId: id,
        deletedAt: null,
      },
    });

    if (activeItemsCount > 0) {
      throw new Error('Cannot archive category with linked items');
    }

    return prisma.$transaction(async (tx) => {
      const archived = await tx.category.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: CATEGORY_INCLUDE,
      });

      if (performedById) {
        await AuditLogService.log(
          'Category',
          id,
          LogAction.DELETED,
          performedById,
          { name: current.name, type: current.type },
          null,
          tx,
        );
      }

      return archived;
    });
  }
}