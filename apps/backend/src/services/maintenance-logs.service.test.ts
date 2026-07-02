import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { EquipmentService } from './equipment.service.js';
import { MaintenanceLogsService } from './maintenance-logs.service.js';
import {
  ConditionStatus,
  MaintenanceStatus,
  EquipmentStatus,
  BorrowStatus,
} from '@prisma/client';

describe('Maintenance Flow Unit Tests', () => {
  let testCategoryId: number;
  let testUserId: number;
  const createdEquipmentIds: number[] = [];

  beforeAll(async () => {
    // Ensure we have a category
    let category = await prisma.category.findFirst({
      where: { name: 'Test Category' },
    });
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Test Category',
          type: 'EQUIPMENT',
          description: 'Test Equipment Category',
        },
      });
    }
    testCategoryId = category.id;

    // Ensure we have a user
    let user = await prisma.user.findFirst({
      where: { email: 'vitest-maint@example.com' },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'vitest-maint@example.com',
          firstName: 'Vitest',
          lastName: 'Maint',
          password: 'dummy-hash',
          roleId: 1,
        },
      });
    }
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    if (createdEquipmentIds.length > 0) {
      await prisma.borrowRecord.deleteMany({
        where: { equipmentId: { in: createdEquipmentIds } },
      });
      await prisma.maintenanceLog.deleteMany({
        where: { equipmentId: { in: createdEquipmentIds } },
      });
      await prisma.equipment.deleteMany({
        where: { id: { in: createdEquipmentIds } },
      });
    }
  });

  it('should not spawn an initial log if equipment is registered as GOOD', async () => {
    const eq = await EquipmentService.create(
      {
        itemName: 'Test Equipment Good',
        categoryId: testCategoryId,
        assetId: `VT-GOOD-${Date.now()}`,
        serialNumber: `SN-VT-GOOD-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    const logs = await prisma.maintenanceLog.findMany({
      where: { equipmentId: eq.id },
    });
    expect(logs.length).toBe(0);
  });

  it('should spawn an initial log if equipment is registered as DAMAGED', async () => {
    const eq = await EquipmentService.create(
      {
        itemName: 'Test Equipment Damaged',
        categoryId: testCategoryId,
        assetId: `VT-DMG-${Date.now()}`,
        serialNumber: `SN-VT-DMG-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.DAMAGED,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    const logs = await prisma.maintenanceLog.findMany({
      where: { equipmentId: eq.id },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].equipmentName).toBe('Test Equipment Damaged');
    expect(logs[0].equipmentCondition).toBe(ConditionStatus.DAMAGED);
  });

  it('should spawn a new unscheduled follow-up log slot if completed in poor condition', async () => {
    const eq = await EquipmentService.create(
      {
        itemName: 'Test Equipment Flow',
        categoryId: testCategoryId,
        assetId: `VT-FLOW-${Date.now()}`,
        serialNumber: `SN-VT-FLOW-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.DAMAGED,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    const logs = await prisma.maintenanceLog.findMany({
      where: { equipmentId: eq.id },
    });
    expect(logs.length).toBe(1);
    const initialLog = logs[0];

    // Set scheduledDate to allow updates
    await prisma.maintenanceLog.update({
      where: { id: initialLog.id },
      data: { scheduledDate: new Date() },
    });

    await MaintenanceLogsService.update(
      initialLog.id,
      {
        status: MaintenanceStatus.COMPLETED,
        completedDate: new Date(),
        postMaintenanceCondition: ConditionStatus.POOR,
      },
      testUserId,
    );

    // Verify parent equipment updated to POOR
    const updatedEq = await prisma.equipment.findUnique({
      where: { id: eq.id },
    });
    expect(updatedEq?.condition).toBe(ConditionStatus.POOR);

    // Verify a new scheduled/unscheduled log was spawned
    const activeLogs = await prisma.maintenanceLog.findMany({
      where: { equipmentId: eq.id, status: MaintenanceStatus.SCHEDULED },
    });
    expect(activeLogs.length).toBe(1);
    expect(activeLogs[0].scheduledDate).toBeNull();
    expect(activeLogs[0].equipmentCondition).toBe(ConditionStatus.POOR);
  });

  it('should filter candidate equipment correctly when needsMaintenance is true', async () => {
    // 1. Create a NEW equipment (should be excluded as it is healthy)
    const eqNew = await EquipmentService.create(
      {
        itemName: 'Test Eq NEW',
        categoryId: testCategoryId,
        assetId: `VT-FILT-NEW-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.NEW,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eqNew.id);

    // 2. Create a GOOD equipment (should be excluded as it is healthy)
    const eqGood = await EquipmentService.create(
      {
        itemName: 'Test Eq GOOD',
        categoryId: testCategoryId,
        assetId: `VT-FILT-GOOD-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eqGood.id);

    // 3. Create a FAIR equipment with an active log (should be excluded)
    const eqFairActive = await EquipmentService.create(
      {
        itemName: 'Test Eq FAIR Active',
        categoryId: testCategoryId,
        assetId: `VT-FILT-FAIR-ACT-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.FAIR,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eqFairActive.id);
    // Keep it active in the db (initial record created automatically is SCHEDULED/null)

    // 4. Create a DAMAGED equipment with completed maintenance (should be included)
    const eqDamagedClean = await EquipmentService.create(
      {
        itemName: 'Test Eq DAMAGED Clean',
        categoryId: testCategoryId,
        assetId: `VT-FILT-DMG-CLN-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.DAMAGED,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eqDamagedClean.id);
    // Delete its automatically created active log to simulate "no active maintenance"
    await prisma.maintenanceLog.deleteMany({
      where: { equipmentId: eqDamagedClean.id },
    });

    // Run the service call with needsMaintenance query filter
    const result = await EquipmentService.findAll({
      needsMaintenance: true,
      limit: 100,
    });

    const returnedIds = result.data.map((eq) => eq.id);

    // Assert eqNew, eqGood, eqFairActive are excluded
    expect(returnedIds).not.toContain(eqNew.id);
    expect(returnedIds).not.toContain(eqGood.id);
    expect(returnedIds).not.toContain(eqFairActive.id);

    // Assert eqDamagedClean is included
    expect(returnedIds).toContain(eqDamagedClean.id);
  });

  it('should return correct maintenance stats from getStats', async () => {
    // Check initial stats
    const statsBefore = await MaintenanceLogsService.getStats();

    // Create a new equipment
    const eq = await EquipmentService.create(
      {
        itemName: 'Test Stats Eq',
        categoryId: testCategoryId,
        assetId: `VT-STATS-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.POOR,
        status: EquipmentStatus.AVAILABLE,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    // Initial automatically created log is SCHEDULED & null scheduledDate.
    // Let's schedule it with a date
    const initialLog = await prisma.maintenanceLog.findFirst({
      where: { equipmentId: eq.id },
    });
    expect(initialLog).toBeDefined();

    await MaintenanceLogsService.schedule(
      initialLog!.id,
      {
        description: 'Schedule maintenance description',
        scheduledDate: new Date(),
        performedByVendor: 'Test Vendor',
      },
      testUserId,
    );

    const statsAfter = await MaintenanceLogsService.getStats();
    expect(statsAfter.total).toBe(statsBefore.total + 1); // Incremented by 1 due to automatic log creation
    expect(statsAfter.scheduled).toBe(statsBefore.scheduled + 1); // Incremented by 1 because we scheduled it
    expect(statsAfter.unscheduled).toBe(statsBefore.unscheduled); // Stays the same (created 1 unscheduled, then scheduled it)
  });

  it('should not allow scheduling maintenance on a borrowed asset if scheduled date is before or equal to expected return date', async () => {
    // 1. Create a healthy equipment
    const eq = await EquipmentService.create(
      {
        itemName: 'Test Borrow Block Eq',
        categoryId: testCategoryId,
        assetId: `VT-BORR-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.BORROWED,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    // Create a maintenance log slot manually
    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId: eq.id,
        description: 'Scheduled maintenance check',
        status: MaintenanceStatus.SCHEDULED,
        scheduledDate: null,
      },
    });

    // 2. Create an active borrow record for the equipment
    const expectedReturnDate = new Date();
    expectedReturnDate.setDate(expectedReturnDate.getDate() + 5);
    expectedReturnDate.setHours(0, 0, 0, 0);

    await prisma.borrowRecord.create({
      data: {
        equipmentId: eq.id,
        borrowedById: testUserId,
        expectedReturn: expectedReturnDate,
        status: BorrowStatus.APPROVED,
      },
    });

    // 3. Attempt to schedule maintenance on a date before expectedReturn (e.g. 2 days from now)
    const invalidScheduleDate = new Date();
    invalidScheduleDate.setDate(invalidScheduleDate.getDate() + 2);

    await expect(
      MaintenanceLogsService.schedule(
        log.id,
        {
          description: 'Routine Checkup',
          scheduledDate: invalidScheduleDate,
          performedByVendor: 'Test Vendor',
        },
        testUserId,
      ),
    ).rejects.toThrow(
      /Cannot schedule maintenance: This asset is currently borrowed until/,
    );

    // 4. Attempt to schedule maintenance on a date after expectedReturn (e.g. 6 days from now)
    const validScheduleDate = new Date();
    validScheduleDate.setDate(validScheduleDate.getDate() + 6);

    const updated = await MaintenanceLogsService.schedule(
      log.id,
      {
        description: 'Routine Checkup',
        scheduledDate: validScheduleDate,
        performedByVendor: 'Test Vendor',
      },
      testUserId,
    );

    expect(updated.status).toBe(MaintenanceStatus.SCHEDULED);
    expect(new Date(updated.scheduledDate!).getDate()).toBe(
      validScheduleDate.getDate(),
    );
  });

  it('should not allow starting maintenance (transitioning to IN_PROGRESS) on a currently borrowed asset', async () => {
    // 1. Create equipment
    const eq = await EquipmentService.create(
      {
        itemName: 'Test Start Block Eq',
        categoryId: testCategoryId,
        assetId: `VT-START-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.BORROWED,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    // Create a maintenance log slot manually
    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId: eq.id,
        description: 'Scheduled maintenance check',
        status: MaintenanceStatus.SCHEDULED,
        scheduledDate: new Date(),
      },
    });

    // 2. Create an active borrow record for the equipment
    const expectedReturnDate = new Date();
    expectedReturnDate.setDate(expectedReturnDate.getDate() + 5);
    expectedReturnDate.setHours(0, 0, 0, 0);

    await prisma.borrowRecord.create({
      data: {
        equipmentId: eq.id,
        borrowedById: testUserId,
        expectedReturn: expectedReturnDate,
        status: BorrowStatus.BORROWED,
      },
    });

    // 3. Attempt to transition status to IN_PROGRESS
    await expect(
      MaintenanceLogsService.update(
        log.id,
        {
          status: MaintenanceStatus.IN_PROGRESS,
        },
        testUserId,
      )
    ).rejects.toThrow(/Cannot start maintenance: This asset is currently borrowed until/);
  });

  it('should not allow starting maintenance (transitioning to IN_PROGRESS) on a currently APPROVED borrowed asset', async () => {
    // 1. Create equipment
    const eq = await EquipmentService.create(
      {
        itemName: 'Test Start Block APP Eq',
        categoryId: testCategoryId,
        assetId: `VT-START-APP-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        condition: ConditionStatus.GOOD,
        status: EquipmentStatus.BORROWED,
        images: [],
      },
      testUserId,
    );
    createdEquipmentIds.push(eq.id);

    // Create a maintenance log slot manually
    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId: eq.id,
        description: 'Scheduled maintenance check',
        status: MaintenanceStatus.SCHEDULED,
        scheduledDate: new Date(),
      },
    });

    // 2. Create an active borrow record for the equipment
    const expectedReturnDate = new Date();
    expectedReturnDate.setDate(expectedReturnDate.getDate() + 5);
    expectedReturnDate.setHours(0, 0, 0, 0);

    await prisma.borrowRecord.create({
      data: {
        equipmentId: eq.id,
        borrowedById: testUserId,
        expectedReturn: expectedReturnDate,
        status: BorrowStatus.APPROVED,
      },
    });

    // 3. Attempt to transition status to IN_PROGRESS
    await expect(
      MaintenanceLogsService.update(
        log.id,
        {
          status: MaintenanceStatus.IN_PROGRESS,
        },
        testUserId,
      )
    ).rejects.toThrow(/Cannot start maintenance: This asset is currently borrowed until/);
  });
});
