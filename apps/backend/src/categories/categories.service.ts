import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException('Category name already exists');
    }

    return this.prisma.category.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: number, data: UpdateCategoryDto) {
    await this.findOne(id);

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
      where: {
        id,
      },
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

    try {
      return await this.prisma.category.delete({
        where: {
          id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Cannot archive category because it is still referenced by existing records.',
        );
      }

      throw error;
    }
  }
}
