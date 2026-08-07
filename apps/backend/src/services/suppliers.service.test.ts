import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { deleteInventoryLogsForTest } from '../lib/test-audit-log.js';
import { SuppliersService } from './suppliers.service.js';
import { AuditLogService } from './audit-log.service.js';

// Covers PR review finding for Defect 210001 "Supplier Profile History -
// No Activity History Displayed": getHistory() previously only returned
// Supplier-type audit logs, so a supplier whose only recorded activity was
// purchase orders showed an empty history. These tests verify the merged
// query returns both Supplier and PurchaseOrder logs, sorted newest-first.
describe('SuppliersService.getHistory (Defect 210001)', () => {
  const supplierName = `History Test Supplier ${Date.now()}`;
  const userEmail = `supplier-history-test-${Date.now()}@example.com`;

  let roleId: number;
  let userId: number;
  let supplierId: number;
  let unrelatedSupplierId: number;
  let categoryId: number;
  let itemId: number;
  let poIdOld: number;
  let poIdNew: number;

  beforeAll(async () => {
    let role = await prisma.role.findFirst({ where: { name: 'STAFF' } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: 'STAFF', description: 'Staff Role' },
      });
    }
    roleId = role.id;

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const user = await prisma.user.create({
      data: {
        firstName: 'History',
        lastName: 'Tester',
        email: userEmail,
        password: hashedPassword,
        roleId,
        isActive: true,
      },
    });
    userId = user.id;

    // Created directly (bypassing SuppliersService.create), so this
    // supplier starts with zero Supplier-type audit logs — matching how
    // seed/legacy suppliers exist in the real database.
    const supplier = await prisma.supplier.create({
      data: { supplierName, contactPerson: 'Test Contact' },
    });
    supplierId = supplier.id;

    // A second, unrelated supplier used to prove its purchase order logs
    // never leak into the supplier-under-test's history.
    const unrelatedSupplier = await prisma.supplier.create({
      data: { supplierName: `Unrelated Supplier ${Date.now()}` },
    });
    unrelatedSupplierId = unrelatedSupplier.id;

    const category = await prisma.category.create({
      data: { name: `supplier-history-test-category-${Date.now()}`, type: 'CONSUMABLE' },
    });
    categoryId = category.id;

    const item = await prisma.item.create({
      data: { itemName: 'Supplier History Test Item', categoryId, itemType: 'CONSUMABLE' },
    });
    itemId = item.id;

    // Two purchase orders for the supplier-under-test, created far enough
    // apart to assert descending order.
    const poOld = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        status: 'DRAFT',
        totalAmount: 1000,
        createdById: userId,
        orderDate: new Date('2026-01-01'),
      },
    });
    poIdOld = poOld.id;
    await AuditLogService.log('PurchaseOrder', poIdOld, 'CREATED', userId, null, poOld);

    const poNew = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        status: 'DRAFT',
        totalAmount: 2000,
        createdById: userId,
        orderDate: new Date('2026-02-01'),
      },
    });
    poIdNew = poNew.id;
    await AuditLogService.log('PurchaseOrder', poIdNew, 'CREATED', userId, null, poNew);

    // One purchase order for the unrelated supplier — its log must not
    // appear in the supplier-under-test's history.
    const poUnrelated = await prisma.purchaseOrder.create({
      data: {
        supplierId: unrelatedSupplierId,
        status: 'DRAFT',
        totalAmount: 500,
        createdById: userId,
        orderDate: new Date(),
      },
    });
    await AuditLogService.log(
      'PurchaseOrder',
      poUnrelated.id,
      'CREATED',
      userId,
      null,
      poUnrelated,
    );

    // A direct profile edit on the supplier-under-test, so both entity
    // types are present in the merged result.
    await SuppliersService.update(
      supplierId,
      { contactPerson: 'Updated Contact' },
      userId,
    );
  });

  afterAll(async () => {
    await deleteInventoryLogsForTest({
      entityType: 'PurchaseOrder',
      entityId: { in: [poIdOld, poIdNew] },
    });
    await deleteInventoryLogsForTest({
      entityType: 'Supplier',
      entityId: supplierId,
    });
    await prisma.purchaseOrder.deleteMany({
      where: { supplierId: { in: [supplierId, unrelatedSupplierId] } },
    });
    await prisma.item.delete({ where: { id: itemId } }).catch(() => undefined);
    await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.supplier
      .deleteMany({ where: { id: { in: [supplierId, unrelatedSupplierId] } } })
      .catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it('returns both Supplier and PurchaseOrder logs for the supplier', async () => {
    const history = await SuppliersService.getHistory(supplierId);

    const supplierLogs = history.filter((h) => h.entityType === 'Supplier');
    const poLogs = history.filter((h) => h.entityType === 'PurchaseOrder');

    expect(supplierLogs.length).toBeGreaterThanOrEqual(1);
    expect(poLogs.map((l) => l.entityId).sort()).toEqual(
      [poIdOld, poIdNew].sort((a, b) => a - b),
    );
  });

  it('sorts merged logs by performedAt descending', async () => {
    const history = await SuppliersService.getHistory(supplierId);

    const timestamps = history.map((h) => new Date(h.performedAt).getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  it('breaks performedAt ties deterministically using id descending', async () => {
    const history = await SuppliersService.getHistory(supplierId);

    // Group consecutive entries by identical performedAt timestamp and
    // assert each group's ids are strictly descending — this is what makes
    // ordering deterministic across repeated calls when logs share a
    // timestamp (e.g. two logs written within the same request).
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];
      if (
        new Date(current.performedAt).getTime() ===
        new Date(next.performedAt).getTime()
      ) {
        expect(current.id).toBeGreaterThan(next.id);
      }
    }
  });

  it('does not include purchase order logs from a different supplier', async () => {
    const history = await SuppliersService.getHistory(supplierId);
    const entityIds = history
      .filter((h) => h.entityType === 'PurchaseOrder')
      .map((h) => h.entityId);

    // Only this supplier's two PO ids should be present — the unrelated
    // supplier's PO log must not leak in.
    expect(entityIds.every((id) => id === poIdOld || id === poIdNew)).toBe(true);
    expect(entityIds).toHaveLength(2);
  });

  it('returns an empty array for a supplier with no recorded activity', async () => {
    const freshSupplier = await prisma.supplier.create({
      data: { supplierName: `No Activity Supplier ${Date.now()}` },
    });

    try {
      const history = await SuppliersService.getHistory(freshSupplier.id);
      expect(history).toEqual([]);
    } finally {
      await prisma.supplier.delete({ where: { id: freshSupplier.id } });
    }
  });
});