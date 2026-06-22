import { prisma } from '../lib/prisma.js';

// Adjust these imports based on your actual validation/type file locations
export interface CreateCategoryInput {
  name: string;
  type: 'EQUIPMENT' | 'CONSUMABLE' | 'DIGITAL';
  description?: string | null ;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: 'EQUIPMENT' | 'CONSUMABLE' | 'DIGITAL';
  description?: string | null;
}

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
    const shouldInclude = includeArchived === true || includeArchived === 'true';

    return prisma.category.findMany({
      where: shouldInclude ? undefined : { deletedAt: null },
      include: CATEGORY_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  static async findOne(id: number) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: CATEGORY_INCLUDE,
    });

    if (!category) {
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
    // 1. Ensure the category actually exists
    await this.findOne(id);

    // 2. We removed the validation check that throws "Cannot archive category. It has active items..."
    // This allows the category to be archived (soft-deleted) while leaving the existing items safely attached.

    return prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: CATEGORY_INCLUDE,
    });
  }
}