import { prisma } from '../lib/prisma.js';
// Updated to import the inferred types directly from your actual Zod schema file
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/categories.schema.js'; // Adjust this relative path if needed

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
  static async create(data: CreateCategoryInput) {
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

    return prisma.category.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
      },
      include: CATEGORY_INCLUDE,
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

  static async update(id: number, data: UpdateCategoryInput) {
    // Ensures archived categories cannot be updated (will throw 'Category not found')
    await this.findOne(id);

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

    return prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
      },
      include: CATEGORY_INCLUDE,
    });
  }

  static async archive(id: number) {
    // Ensures category exists and isn't already archived before updating
    await this.findOne(id);

    const activeItemsCount = await prisma.item.count({
      where: {
        categoryId: id,
        deletedAt: null,
      },
    });

    if (activeItemsCount > 0) {
      throw new Error('Cannot archive category with linked items');
    }

    return prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: CATEGORY_INCLUDE,
    });
  }
}
