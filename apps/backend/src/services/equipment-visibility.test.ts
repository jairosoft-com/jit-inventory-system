import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { EquipmentService } from './equipment.service.js';
import { ConditionStatus, EquipmentStatus } from '@prisma/client';

describe('Equipment Damage Visibility Tests', () => {
  let testCategoryId: number;
  let testAdminUserId: number;
  let staffRoleId: number;
  let adminRoleId: number;
  const createdEquipmentIds: number[] = [];

  beforeAll(async () => {
    // Ensure we have a category
    let category = await prisma.category.findFirst({
      where: { name: 'Test Visibility Category' },
    });
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Test Visibility Category',
          type: 'EQUIPMENT',
          description: 'Test Visibility Equipment Category',
        },
      });
    }
    testCategoryId = category.id;

    // Resolve or seed roles
    let staffRole = await prisma.role.findFirst({ where: { name: 'STAFF' } });
    if (!staffRole) {
      staffRole = await prisma.role.create({
        data: { name: 'STAFF', description: 'Staff Role' },
      });
    }
    staffRoleId = staffRole.id;

    let adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { name: 'ADMIN', description: 'Admin Role' },
      });
    }
    adminRoleId = adminRole.id;

    // Ensure we have a user
    let user = await prisma.user.findFirst({
      where: { email: 'vitest-visibility@example.com' },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'vitest-visibility@example.com',
          firstName: 'Vitest',
          lastName: 'Visibility',
          password: 'dummy-hash',
          roleId: adminRoleId,
        },
      });
    }
    testAdminUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    if (createdEquipmentIds.length > 0) {
      await prisma.maintenanceLog.deleteMany({
        where: { equipmentId: { in: createdEquipmentIds } },
      });
      await prisma.equipment.deleteMany({
        where: { id: { in: createdEquipmentIds } },
      });
    }
  });

  it('should list damaged equipment for admin but filter it out for staff', async () => {
    // 1. Create a DAMAGED equipment
    const eqDmg = await EquipmentService.create(
      {
        itemName: 'Test Damaged Equipment',
        categoryId: testCategoryId,
        assetId: `VT-DMG-VIS-${Date.now()}`,
        serialNumber: `SN-VT-DMG-VIS-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.DAMAGED,
        status: EquipmentStatus.DAMAGED,
        images: [],
      },
      testAdminUserId,
    );
    createdEquipmentIds.push(eqDmg.id);

    // 2. Create an AVAILABLE equipment
    const eqAvail = await EquipmentService.create(
      {
        itemName: 'Test Available Equipment',
        categoryId: testCategoryId,
        assetId: `VT-AV-VIS-${Date.now()}`,
        serialNumber: `SN-VT-AV-VIS-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testAdminUserId,
    );
    createdEquipmentIds.push(eqAvail.id);

    // 3. FindAll with adminRoleId
    const adminResult = await EquipmentService.findAll({}, adminRoleId);
    const adminIds = adminResult.data.map((e) => e.id);
    expect(adminIds).toContain(eqDmg.id);
    expect(adminIds).toContain(eqAvail.id);

    // 4. FindAll with staffRoleId
    const staffResult = await EquipmentService.findAll({}, staffRoleId);
    const staffIds = staffResult.data.map((e) => e.id);
    expect(staffIds).not.toContain(eqDmg.id);
    expect(staffIds).toContain(eqAvail.id);
  });

  it('should filter out equipment with RETIREMENT_PENDING status if its condition is DAMAGED for staff', async () => {
    // 1. Create a RETIREMENT_PENDING equipment with DAMAGED condition
    const eqRetireDmg = await EquipmentService.create(
      {
        itemName: 'Test Retire Pending Damaged Equipment',
        categoryId: testCategoryId,
        assetId: `VT-RP-DMG-${Date.now()}`,
        serialNumber: `SN-VT-RP-DMG-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.DAMAGED,
        status: EquipmentStatus.RETIREMENT_PENDING,
        images: [],
      },
      testAdminUserId,
    );
    createdEquipmentIds.push(eqRetireDmg.id);

    // 2. FindAll with adminRoleId should contain it
    const adminResult = await EquipmentService.findAll({}, adminRoleId);
    const adminIds = adminResult.data.map((e) => e.id);
    expect(adminIds).toContain(eqRetireDmg.id);

    // 3. FindAll with staffRoleId should filter it out
    const staffResult = await EquipmentService.findAll({}, staffRoleId);
    const staffIds = staffResult.data.map((e) => e.id);
    expect(staffIds).not.toContain(eqRetireDmg.id);
  });
});
