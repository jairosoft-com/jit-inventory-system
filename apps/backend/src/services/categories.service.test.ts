import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { CategoriesService } from './categories.service.js';

describe('Categories Service Unit Tests', () => {
  let testCategoryId: number;
  let testItemId: number;

  beforeAll(async () => {
    // Cleanup any remnants from previous failed tests
    await prisma.item.deleteMany({
      where: { itemName: 'Test Archiving Item' },
    });
    await prisma.category.deleteMany({
      where: { name: 'Test Archiving Category' },
    });
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.consumableProfile.deleteMany({
      where: { itemId: testItemId },
    });
    await prisma.item.deleteMany({
      where: { id: testItemId },
    });
    await prisma.category.delete({
      where: { id: testCategoryId },
    }).catch(() => {});
  });

  it('should prevent archiving a category that has linked active inventory items', async () => {
    // 1. Create category
    const category = await prisma.category.create({
      data: {
        name: 'Test Archiving Category',
        type: 'CONSUMABLE',
        description: 'Testing protection from archival',
      },
    });
    testCategoryId = category.id;

    // 2. Create active item under category
    const item = await prisma.item.create({
      data: {
        itemName: 'Test Archiving Item',
        categoryId: category.id,
        itemType: 'CONSUMABLE',
        consumableProfile: {
          create: {
            unit: 'pcs',
            quantity: 5,
            reorderPoint: 2,
          },
        },
      },
    });
    testItemId = item.id;

    // 3. Attempt to archive category -> should fail
    await expect(CategoriesService.archive(category.id)).rejects.toThrow(
      'Cannot archive category with linked items',
    );
  });

  it('should allow archiving a category when linked items are archived', async () => {
    // 1. Archive the item
    await prisma.item.update({
      where: { id: testItemId },
      data: { deletedAt: new Date() },
    });

    // 2. Attempt to archive category -> should succeed
    const archivedCategory = await CategoriesService.archive(testCategoryId);
    expect(archivedCategory.deletedAt).not.toBeNull();
  });
});
