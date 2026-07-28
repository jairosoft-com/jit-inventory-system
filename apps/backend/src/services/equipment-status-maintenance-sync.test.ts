import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { EquipmentService } from './equipment.service.js';
import { ConditionStatus, EquipmentStatus, MaintenanceStatus } from '@prisma/client';

// Regression tests for Defect 208893: Admin/Manager - 'Under Maintenance' status
// changed from the Equipment module must automatically create or update the
// corresponding maintenance record so it is reflected on the Maintenance page.
describe('Equipment status -> Maintenance record sync', () => {
  let testCategoryId: number;
  let testUserId: number;
  const createdEquipmentIds: number[] = [];

  beforeAll(async () => {
    let category = await prisma.category.findFirst({
      where: { name: 'Status Sync Test Category' },
    });
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Status Sync Test Category',
          type: 'EQUIPMENT',
          description: 'Status Sync Test Category Description',
        },
      });
    }
    testCategoryId = category.id;

    let user = await prisma.user.findFirst({
      where: { email: 'vitest-status-sync@example.com' },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'vitest-status-sync@example.com',
          firstName: 'Vitest',
          lastName: 'StatusSync',
          password: 'dummy-hash',
          roleId: 1,
        },
      });
    }
    testUserId = user.id;
  });

  afterAll(async () => {
    if (createdEquipmentIds.length > 0) {
      await prisma.maintenanceAlert.deleteMany({
        where: {
          maintenanceLog: { equipmentId: { in: createdEquipmentIds } },
        },
      });
      await prisma.maintenanceLog.deleteMany({
        where: { equipmentId: { in: createdEquipmentIds } },
      });
      await prisma.equipmentImage.deleteMany({
        where: { equipmentId: { in: createdEquipmentIds } },
      });
      await prisma.equipment.deleteMany({
        where: { id: { in: createdEquipmentIds } },
      });
    }
  });

  it('creates a maintenance log automatically when equipment status is changed to UNDER_MAINTENANCE', async () => {
    const eq = await EquipmentService.create(
      {
        itemName: 'Sync Test Laptop',
        categoryId: testCategoryId,
        assetId: `VT-SYNC-${Date.now()}`,
        serialNumber: `SN-VT-SYNC-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    // No maintenance log should exist yet.
    const before = await prisma.maintenanceLog.findFirst({
      where: { equipmentId: eq.id },
    });
    expect(before).toBeNull();

    const updated = await EquipmentService.update(
      eq.id,
      { status: EquipmentStatus.UNDER_MAINTENANCE },
      testUserId,
    );
    expect(updated.status).toBe(EquipmentStatus.UNDER_MAINTENANCE);

    const log = await prisma.maintenanceLog.findFirst({
      where: { equipmentId: eq.id },
    });
    expect(log).not.toBeNull();
    expect(log?.status).toBe(MaintenanceStatus.IN_PROGRESS);
  });

  it('updates the existing active maintenance log instead of creating a duplicate', async () => {
    const eq = await EquipmentService.create(
      {
        itemName: 'Sync Test Printer',
        categoryId: testCategoryId,
        assetId: `VT-SYNC2-${Date.now()}`,
        serialNumber: `SN-VT-SYNC2-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.FAIR,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    // FAIR condition on creation auto-spawns a SCHEDULED maintenance log.
    const scheduledLog = await prisma.maintenanceLog.findFirst({
      where: { equipmentId: eq.id },
    });
    expect(scheduledLog?.status).toBe(MaintenanceStatus.SCHEDULED);

    await EquipmentService.update(
      eq.id,
      { status: EquipmentStatus.UNDER_MAINTENANCE },
      testUserId,
    );

    const logsAfter = await prisma.maintenanceLog.findMany({
      where: { equipmentId: eq.id },
    });

    // The pre-existing scheduled log should be promoted to IN_PROGRESS,
    // not duplicated with a second active record.
    expect(logsAfter.length).toBe(1);
    expect(logsAfter[0].status).toBe(MaintenanceStatus.IN_PROGRESS);
  });
});