import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}
<<<<<<< HEAD

  async create(data: CreateCategoryDto) {
    // Case-insensitive lookup (including archived)
=======
 
  async create(data: { name: string; type: ItemType; description?: string }) {
    const name = data?.name?.trim();
    if (!name) {
      throw new BadRequestException('Category name is required');
    }
    if (!data?.type || !Object.values(ItemType).includes(data.type)) {
      throw new BadRequestException('Category type is invalid');
    }

    // Case-insensitive lookup
>>>>>>> 19a41c4616f0298b0f6066c46fdc07280ded17de
    const existing = await this.prisma.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
<<<<<<< HEAD
      throw new ConflictException('Category name already exists');
    }

    return this.prisma.category.create({ data });
=======
      // If soft-deleted, restore it instead of throwing error
      if (existing.deletedAt) {
        return this.prisma.category.update({
          where: { id: existing.id },
          data: {
            ...data,
            name,
            deletedAt: null, // unarchive
          }
        });
      }
 
      throw new ConflictException('Category name already exists');
    }
 
    return this.prisma.category.create({ data: { ...data, name } });
>>>>>>> 19a41c4616f0298b0f6066c46fdc07280ded17de
  }

  async findAll() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category || category.deletedAt) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }
<<<<<<< HEAD

  async update(id: number, data: UpdateCategoryDto) {
    await this.findOne(id);
=======
 
  async update(id: number, data: { name?: string; type?: ItemType; description?: string }) {
    await this.findOne(id); // ensures category exists and is not archived

    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException('Category name cannot be empty');
    }
    if (data.type !== undefined && !Object.values(ItemType).includes(data.type)) {
      throw new BadRequestException('Category type is invalid');
    }
>>>>>>> 19a41c4616f0298b0f6066c46fdc07280ded17de

    if (data.name) {
      const existing = await this.prisma.category.findFirst({
        where: {
          name: {
            equals: data.name,
            mode: 'insensitive',
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Category name already exists');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async archive(id: number) {
    await this.findOne(id);

    const activeItemsCount = await this.prisma.item.count({
      where: {
        categoryId: id,
        deletedAt: null,
      },
    });

    if (activeItemsCount > 0) {
      throw new BadRequestException(
        `Cannot archive category. It has ${activeItemsCount} active item(s) assigned to it.`,
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}