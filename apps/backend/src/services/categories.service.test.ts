import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { CategoriesService } from './categories.service.js';

const TEST_PERFORMER_ID = 1; // system/admin user assumed to exist in test DB

describe('Categories Service Unit Tests', () => {
  let testCategoryId: number;
  let testItemId: number;

  beforeAll(async () => {
    // Cleanup any remnants from previous failed tests
    await prisma.item.deleteMany({
      where: {
        itemName: { in: ['Test Archiving Item', 'Test Type Change Item'] },
      },
    });
    await prisma.category.deleteMany({
      where: {
        name: { in: ['Test Archiving Category', 'Test Type Change Category', 'Test Audit Category'] },
      },
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
    await prisma.category
      .delete({
        where: { id: testCategoryId },
      })
      .catch(() => {});
  });

  it('should write a CREATED audit log entry when performedById is provided', async () => {
    const before = await prisma.inventoryLog.count({
      where: { entityType: 'Category', action: 'CREATED' },
    });

    const category = await CategoriesService.create(
      { name: 'Test Audit Category', type: 'CONSUMABLE' },
      TEST_PERFORMER_ID,
    );

    const after = await prisma.inventoryLog.count({
      where: { entityType: 'Category', action: 'CREATED', entityId: category.id },
    });

    expect(after).toBe(before + 1);

    // Cleanup
    await prisma.category.delete({ where: { id: category.id } });
  });

  it('should NOT write an audit log entry when performedById is omitted', async () => {
    const category = await CategoriesService.create({
      name: 'Test Audit Category',
      type: 'CONSUMABLE',
    });

    const logCount = await prisma.inventoryLog.count({
      where: { entityType: 'Category', entityId: category.id },
    });

    expect(logCount).toBe(0);

    // Cleanup
    await prisma.category.delete({ where: { id: category.id } });
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
    await expect(CategoriesService.archive(category.id, TEST_PERFORMER_ID)).rejects.toThrow(
      'Cannot archive category with linked items',
    );

    // 4. No audit log should have been written on failure
    const logCount = await prisma.inventoryLog.count({
      where: { entityType: 'Category', entityId: category.id, action: 'DELETED' },
    });
    expect(logCount).toBe(0);
  });

  it('should allow archiving a category when linked items are archived and write audit log', async () => {
    // 1. Archive the item
    await prisma.item.update({
      where: { id: testItemId },
      data: { deletedAt: new Date() },
    });

    // 2. Attempt to archive category -> should succeed
    const archivedCategory = await CategoriesService.archive(testCategoryId, TEST_PERFORMER_ID);
    expect(archivedCategory.deletedAt).not.toBeNull();

    // 3. Assert audit log was written
    const logCount = await prisma.inventoryLog.count({
      where: { entityType: 'Category', entityId: testCategoryId, action: 'DELETED' },
    });
    expect(logCount).toBe(1);
  });

  it('should prevent changing category type when active items are linked', async () => {
    // 1. Create a new category
    const category = await prisma.category.create({
      data: {
        name: 'Test Type Change Category',
        type: 'CONSUMABLE',
      },
    });

    // 2. Create active item linked to it
    const item = await prisma.item.create({
      data: {
        itemName: 'Test Type Change Item',
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

    // 3. Attempt to change category type -> should fail
    await expect(
      CategoriesService.update(category.id, { type: 'EQUIPMENT' }, TEST_PERFORMER_ID),
    ).rejects.toThrow(
      'Cannot change category type when active items are linked',
    );

    // 4. No audit log should have been written on failure
    const logCount = await prisma.inventoryLog.count({
      where: { entityType: 'Category', entityId: category.id, action: 'UPDATED' },
    });
    expect(logCount).toBe(0);

    // 5. Cleanup
    await prisma.consumableProfile.deleteMany({
      where: { itemId: item.id },
    });
    await prisma.item.deleteMany({
      where: { id: item.id },
    });
    await prisma.category.delete({
      where: { id: category.id },
    });
  });
});