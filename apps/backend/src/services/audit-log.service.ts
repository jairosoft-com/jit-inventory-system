import { LogAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface AuditLogQuery {
  entityType?: string;
  entityId?: number;
  action?: LogAction;
  performedBy?: number;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

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

  static async findAll(query: AuditLogQuery) {
    const { entityType, entityId, action, performedBy, startDate, endDate, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryLogWhereInput = {
      ...(entityType && { entityType }),
      ...(entityId !== undefined && { entityId }),
      ...(action && { action }),
      ...(performedBy !== undefined && { performedBy }),
      ...(startDate || endDate
        ? {
            performedAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { performedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async findOne(id: number) {
    const log = await prisma.inventoryLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!log) {
      throw new Error('Audit log entry not found');
    }
    return log;
  }
}
