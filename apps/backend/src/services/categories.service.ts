import { LogAction } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
// Updated to import the inferred types directly from your actual Zod schema file
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/categories.schema.js'; // Adjust this relative path if needed
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

    const category = await prisma.category.create({
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
      ).catch((err: unknown) => {
        console.error('[AuditLog] Failed to log Category CREATED:', err);
      });
    }

    return category;
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
    // Fixed: Uses findFirst to filter out soft-deleted/archived categories
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
    // Ensures archived categories cannot be updated (will throw 'Category not found')
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

    const updated = await prisma.category.update({
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
      ).catch((err: unknown) => {
        console.error('[AuditLog] Failed to log Category UPDATED:', err);
      });
    }

    return updated;
  }

  static async archive(id: number, performedById?: number) {
    // Ensures category exists and isn't already archived before updating
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

    const archived = await prisma.category.update({
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
      ).catch((err: unknown) => {
        console.error('[AuditLog] Failed to log Category DELETED:', err);
      });
    }

    return archived;
  }
}