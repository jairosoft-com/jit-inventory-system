import { ItemType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from '../schemas/categories.schema.js';

const CATEGORY_INCLUDE = {
  _count: {
    select: {
      items: {
        where: { deletedAt: null },
      },
    },
  },
} as const;

type FindAllCategoriesQuery = Omit<
  Partial<ListCategoriesQuery>,
  'includeArchived'
> & {
  includeArchived?: boolean | string;
};

function isCategoryType(value: unknown): value is ItemType {
  return (
    value === ItemType.EQUIPMENT ||
    value === ItemType.CONSUMABLE ||
    value === ItemType.DIGITAL
  );
}

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
      include: CATEGORY_INCLUDE,
    });
  }

  static async findAll(query: FindAllCategoriesQuery = {}) {
    const shouldIncludeArchived =
      query.includeArchived === true || query.includeArchived === 'true';

    const search = typeof query.search === 'string' ? query.search.trim() : '';

    const type = isCategoryType(query.type) ? query.type : undefined;

    const where: Prisma.CategoryWhereInput = {
      ...(shouldIncludeArchived ? {} : { deletedAt: null }),
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(type ? { type } : {}),
    };

    return prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: CATEGORY_INCLUDE,
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
      include: CATEGORY_INCLUDE,
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
      include: CATEGORY_INCLUDE,
    });
  }
}
