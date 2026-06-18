import { LogAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export class AuditLogService {
  static async log(
    entityType: string,
    entityId: number,
    action: LogAction,
    performedBy: number,
    oldData?: any,
    newData?: any,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? prisma;
    await client.inventoryLog.create({
      data: {
        entityType,
        entityId,
        action,
        performedBy,
        oldData:
          oldData !== undefined && oldData !== null
            ? (oldData as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        newData:
          newData !== undefined && newData !== null
            ? (newData as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
  }
}
