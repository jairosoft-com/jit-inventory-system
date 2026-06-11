import { prisma } from '../lib/prisma.js';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/categories.schema.js';

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
      throw new Error('Category name already exists');
    }

    return prisma.category.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
      },
    });
  }

  static async findAll(includeArchived: boolean | string = false) {
    const shouldInclude =
      includeArchived === true || includeArchived === 'true';
    return prisma.category.findMany({
      where: shouldInclude ? {} : { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            items: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  static async findOne(id: number) {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category || category.deletedAt) {
      throw new Error('Category not found');
    }

    return category;
  }

  static async update(id: number, data: UpdateCategoryInput) {
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
    });
  }

  static async archive(id: number) {
    await this.findOne(id);

    const activeItemsCount = await prisma.item.count({
      where: {
        categoryId: id,
        deletedAt: null,
      },
    });

    if (activeItemsCount > 0) {
      throw new Error(
        `Cannot archive category. It has ${activeItemsCount} active item(s) assigned to it.`,
      );
    }

    return prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
