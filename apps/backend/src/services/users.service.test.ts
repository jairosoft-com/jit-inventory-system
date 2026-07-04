import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { deleteInventoryLogsForTest } from '../lib/test-audit-log.js';
import { UsersService } from './users.service.js';
import { LogAction } from '@prisma/client';

// Covers task 207940 "Log user management actions" (ticket 206479):
// user create / profile update / role & status changes are admin
// actions and must produce an audit trail entry, same as any other
// user action.
describe('UsersService activity logging (task 207940)', () => {
  let adminRoleId: number;
  let staffRoleId: number;
  let adminUserId: number;
  let targetUserId: number;

  const targetEmail = 'user-mgmt-audit-test@example.com';

  beforeAll(async () => {
    let adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { name: 'ADMIN', description: 'Admin Role' },
      });
    }
    adminRoleId = adminRole.id;

    let staffRole = await prisma.role.findFirst({ where: { name: 'STAFF' } });
    if (!staffRole) {
      staffRole = await prisma.role.create({
        data: { name: 'STAFF', description: 'Staff Role' },
      });
    }
    staffRoleId = staffRole.id;

    await prisma.user.deleteMany({ where: { email: targetEmail } });

    const admin = await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'Auditor',
        email: 'user-mgmt-admin-actor@example.com',
        password: 'not-used-in-these-tests',
        roleId: adminRoleId,
        isActive: true,
      },
    });
    adminUserId = admin.id;
  });

  afterAll(async () => {
    await deleteInventoryLogsForTest({
      entityType: 'User',
      entityId: { in: [targetUserId, adminUserId] },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [targetUserId, adminUserId] } },
    });
  });

  it('logs a CREATED entry attributed to the admin who created the user', async () => {
    const created = await UsersService.create(
      {
        firstName: 'New',
        lastName: 'Hire',
        email: targetEmail,
        password: 'Password123!',
        roleId: staffRoleId,
        isActive: true,
      },
      adminUserId,
    );
    targetUserId = created.id;

    const log = await prisma.inventoryLog.findFirst({
      where: {
        entityType: 'User',
        entityId: targetUserId,
        action: LogAction.CREATED,
      },
    });

    expect(log).not.toBeNull();
    expect(log?.performedBy).toBe(adminUserId);
    // Passwords/hashes must never be written to the audit trail.
    expect(JSON.stringify(log?.newData)).not.toMatch(/password/i);
  });

  it('logs an UPDATED entry with before/after state when profile fields change', async () => {
    await UsersService.update(
      targetUserId,
      { firstName: 'Updated' },
      adminUserId,
    );

    const log = await prisma.inventoryLog.findFirst({
      where: {
        entityType: 'User',
        entityId: targetUserId,
        action: LogAction.UPDATED,
      },
      orderBy: { performedAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.performedBy).toBe(adminUserId);
    expect(log?.oldData).not.toBeNull();
    expect(log?.newData).not.toBeNull();
  });

  it("logs an UPDATED entry when an admin changes a user's role or active status", async () => {
    await UsersService.updateAccess(
      targetUserId,
      { isActive: false },
      adminUserId,
    );

    const log = await prisma.inventoryLog.findFirst({
      where: {
        entityType: 'User',
        entityId: targetUserId,
        action: LogAction.UPDATED,
      },
      orderBy: { performedAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.performedBy).toBe(adminUserId);

    // Reactivate so cleanup / further tests aren't affected by deactivation.
    await UsersService.updateAccess(
      targetUserId,
      { isActive: true },
      adminUserId,
    );
  });
});