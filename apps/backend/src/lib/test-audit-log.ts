import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/**
 * Test-only helper for cleaning up `inventory_logs` rows created by
 * integration tests.
 *
 * `trg_inventory_logs_immutable` (see migration
 * 20260702010000_add_audit_log_immutability_and_permissions) blocks all
 * UPDATE/DELETE on inventory_logs at the database level, by design — audit
 * logs must be append-only in every environment, including test.
 *
 * That trigger has no exception for test teardown, so `deleteMany()` in a
 * suite's `afterAll` throws and aborts cleanup. This helper temporarily
 * disables the trigger for the current connection, runs the deletion, and
 * re-enables the trigger immediately afterward (even if the deletion
 * throws), so the guard is never left off.
 *
 * IMPORTANT: only ever call this from test setup/teardown code. It must
 * never be reachable from application/service code — doing so would defeat
 * the immutability guarantee the trigger exists to enforce.
 */
export async function deleteInventoryLogsForTest(
  where: Prisma.InventoryLogWhereInput,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE inventory_logs DISABLE TRIGGER trg_inventory_logs_immutable',
  );
  try {
    await prisma.inventoryLog.deleteMany({ where });
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE inventory_logs ENABLE TRIGGER trg_inventory_logs_immutable',
    );
  }
}
