import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ItemType } from '@prisma/client';
 
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}
 
  async create(data: { name: string; type: ItemType; description?: string }) {
    // Case-insensitive lookup
    const existing = await this.prisma.category.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
      },
    });
 
    if (existing) {
      // If soft-deleted, restore it instead of throwing error
      if (existing.deletedAt) {
        return this.prisma.category.update({
          where: { id: existing.id },
          data: {
            ...data,
            deletedAt: null, // unarchive
          },
        });
      }
 
      throw new ConflictException('Category name already exists');
    }
 
    return this.prisma.category.create({ data });
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
 
  async update(id: number, data: { name?: string; type?: ItemType; description?: string }) {
    await this.findOne(id); // ensures category exists and is not archived
 
    if (data.name) {
      // Case-insensitive lookup
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
    await this.findOne(id); // ensures category exists and is not already archived
 
    // Check if category has active items
    const activeItemsCount = await this.prisma.item.count({
      where: {
        categoryId: id,
        deletedAt: null, // only count active items
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