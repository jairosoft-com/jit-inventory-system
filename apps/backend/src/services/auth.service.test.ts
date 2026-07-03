import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { deleteInventoryLogsForTest } from '../lib/test-audit-log.js';
import { AuthService } from './auth.service.js';
import { LogAction } from '@prisma/client';

// Covers User Story 206479 "Record User Activity Logs":
// login/logout are user actions and must produce an audit trail
// entry recording who performed the action and when.
describe('AuthService activity logging (ticket 206479)', () => {
  const testEmail = 'audit-log-test-user@example.com';
  const testPassword = 'Password123!';
  let testUserId: number;
  let testRoleId: number;

  beforeAll(async () => {
    let role = await prisma.role.findFirst({ where: { name: 'STAFF' } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: 'STAFF', description: 'Staff Role' },
      });
    }
    testRoleId = role.id;

    await prisma.user.deleteMany({ where: { email: testEmail } });

    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        firstName: 'Audit',
        lastName: 'Tester',
        email: testEmail,
        password: hashedPassword,
        roleId: testRoleId,
        isActive: true,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await deleteInventoryLogsForTest({
      entityType: 'User',
      entityId: testUserId,
    });
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it('creates an audit record with user identity, action, and timestamp on successful login', async () => {
    const validatedUser = await AuthService.validateUser(
      testEmail,
      testPassword,
    );
    const before = new Date();
    const { refreshToken } = await AuthService.login(validatedUser);

    const log = await prisma.inventoryLog.findFirst({
      where: {
        entityType: 'User',
        entityId: testUserId,
        action: LogAction.LOGIN,
      },
      orderBy: { performedAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.performedBy).toBe(testUserId);
    expect(log?.performedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000,
    );

    // Cleanup the refresh token created by this login
    await AuthService.logout(refreshToken);
  });

  it('creates an audit record when the user logs out', async () => {
    const validatedUser = await AuthService.validateUser(
      testEmail,
      testPassword,
    );
    const { refreshToken } = await AuthService.login(validatedUser);

    await AuthService.logout(refreshToken);

    const log = await prisma.inventoryLog.findFirst({
      where: {
        entityType: 'User',
        entityId: testUserId,
        action: LogAction.LOGOUT,
      },
      orderBy: { performedAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.performedBy).toBe(testUserId);
  });

  it('does not create an audit record for a failed login attempt', async () => {
    const countBefore = await prisma.inventoryLog.count({
      where: { entityType: 'User', entityId: testUserId },
    });

    await expect(
      AuthService.validateUser(testEmail, 'wrong-password'),
    ).rejects.toThrow('Invalid email or password');

    const countAfter = await prisma.inventoryLog.count({
      where: { entityType: 'User', entityId: testUserId },
    });

    expect(countAfter).toBe(countBefore);
  });

  it('rejects any attempt to modify or delete an audit record (DB-level immutability)', async () => {
    const log = await prisma.inventoryLog.findFirst({
      where: { entityType: 'User', entityId: testUserId },
    });
    expect(log).not.toBeNull();

    await expect(
      prisma.inventoryLog.update({
        where: { id: log!.id },
        data: { action: LogAction.LOGOUT },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.inventoryLog.delete({ where: { id: log!.id } }),
    ).rejects.toThrow();
  });
});