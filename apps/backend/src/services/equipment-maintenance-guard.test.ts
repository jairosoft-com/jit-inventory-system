import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { EquipmentService } from './equipment.service.js';
import { ConditionStatus, EquipmentStatus } from '@prisma/client';

describe('Equipment Maintenance Guard Tests', () => {
  let testCategoryId: number;
  let testUserId: number;
  const createdEquipmentIds: number[] = [];

  beforeAll(async () => {
    // Ensure category exists
    let category = await prisma.category.findFirst({
      where: { name: 'Guard Test Category' },
    });
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Guard Test Category',
          type: 'EQUIPMENT',
          description: 'Guard Test Category Description',
        },
      });
    }
    testCategoryId = category.id;

    // Ensure user exists
    let user = await prisma.user.findFirst({
      where: { email: 'vitest-guard@example.com' },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'vitest-guard@example.com',
          firstName: 'Vitest',
          lastName: 'Guard',
          password: 'dummy-hash',
          roleId: 1, // ADMIN or baseline role
        },
      });
    }
    testUserId = user.id;
  });

  afterAll(async () => {
    if (createdEquipmentIds.length > 0) {
      await prisma.equipmentImage.deleteMany({
        where: { equipmentId: { in: createdEquipmentIds } },
      });
      await prisma.disposal.deleteMany({
        where: { equipmentId: { in: createdEquipmentIds } },
      });
      await prisma.equipment.deleteMany({
        where: { id: { in: createdEquipmentIds } },
      });
    }
  });

  it('should allow modification actions when equipment status is AVAILABLE', async () => {
    const eq = await EquipmentService.create(
      {
        itemName: 'Healthy Laptop',
        categoryId: testCategoryId,
        assetId: `VT-OK-${Date.now()}`,
        serialNumber: `SN-VT-OK-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    // 1. Update should succeed
    const updated = await EquipmentService.update(
      eq.id,
      { brand: 'UpdatedBrand' },
      testUserId,
    );
    expect(updated.brand).toBe('UpdatedBrand');

    // 2. Set replacement needed should succeed
    const updatedRepl = await EquipmentService.setReplacementNeeded(
      eq.id,
      { replacementNeeded: true },
      testUserId,
    );
    expect(updatedRepl.replacementNeeded).toBe(true);
  });

  it('should throw errors for modifications when equipment status is UNDER_MAINTENANCE', async () => {
    const eq = await EquipmentService.create(
      {
        itemName: 'Maintained Printer',
        categoryId: testCategoryId,
        assetId: `VT-MAINT-${Date.now()}`,
        serialNumber: `SN-VT-MAINT-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.UNDER_MAINTENANCE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    // 1. Update should fail
    await expect(
      EquipmentService.update(eq.id, { brand: 'FailBrand' }, testUserId),
    ).rejects.toThrow(
      'Equipment is under active maintenance and cannot be modified',
    );

    // 2. Set replacement needed should fail
    await expect(
      EquipmentService.setReplacementNeeded(
        eq.id,
        { replacementNeeded: true },
        testUserId,
      ),
    ).rejects.toThrow(
      'Equipment is under active maintenance and cannot be modified',
    );

    // 3. Retirement request eligibility error should be returned
    await expect(
      EquipmentService.submitRetirementRequest(
        eq.id,
        { reason: 'DAMAGED_BEYOND_REPAIR', method: 'E-Waste Recycler' },
        testUserId,
      ),
    ).rejects.toThrow(
      'Equipment is currently under maintenance and cannot be retired',
    );

    // 4. Soft delete should fail
    await expect(
      EquipmentService.softDelete(eq.id, testUserId),
    ).rejects.toThrow(
      'Equipment is under active maintenance and cannot be modified',
    );

    // 5. Image additions should fail
    await expect(
      EquipmentService.addImage(eq.id, {
        url: 'http://example.com/img.png',
        label: 'label',
        isPrimary: true,
      }),
    ).rejects.toThrow(
      'Equipment is under active maintenance and cannot be modified',
    );
  });
});
