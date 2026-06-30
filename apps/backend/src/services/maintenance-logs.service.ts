import { prisma } from '../lib/prisma.js';
import {
  MaintenanceStatus,
  LogAction,
  EquipmentStatus,
  Prisma,
} from '@prisma/client';
import { AuditLogService } from './audit-log.service.js';
import type {
  ScheduleMaintenanceInput,
  UpdateMaintenanceScheduleInput,
  ListMaintenanceLogsQuery,
} from '../schemas/maintenance-logs.schema.js';

export class MaintenanceLogsService {
  private static async assertNoActiveMaintenance(
    equipmentId: number,
    excludeLogId?: number,
  ) {
    const activeLog = await prisma.maintenanceLog.findFirst({
      where: {
        equipmentId,
        status: {
          in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS],
        },
        id: excludeLogId ? { not: excludeLogId } : undefined,
      },
    });

    if (activeLog) {
      throw new Error(
        'Equipment already has an active/open maintenance record',
      );
    }
  }

  static async create(
    data: { equipmentId: number; description: string },
    userId: number,
  ) {
    const equipment = await prisma.equipment.findUnique({
      where: { id: data.equipmentId },
    });

    if (!equipment || equipment.deletedAt) {
      throw new Error('Equipment not found');
    }

    await this.assertNoActiveMaintenance(data.equipmentId);

    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId: data.equipmentId,
        description: data.description,
        status: MaintenanceStatus.SCHEDULED,
        scheduledDate: null,
      },
      include: {
        equipment: {
          include: { item: { select: { itemName: true } } },
        },
      },
    });

    await AuditLogService.log(
      'MaintenanceLog',
      log.id,
      LogAction.CREATED,
      userId,
      null,
      log,
    );

    return log;
  }

  static async findAll(query: ListMaintenanceLogsQuery) {
    const { status, equipmentId, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MaintenanceLogWhereInput = {
      equipment: {
        deletedAt: null,
      },
    };

    if (status) {
      where.status = status;
    }

    if (equipmentId) {
      where.equipmentId = equipmentId;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { performedByVendor: { contains: search, mode: 'insensitive' } },
        {
          equipment: {
            OR: [
              { assetId: { contains: search, mode: 'insensitive' } },
              { serialNumber: { contains: search, mode: 'insensitive' } },
              {
                item: {
                  itemName: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.maintenanceLog.findMany({
        where,
        include: {
          equipment: {
            include: {
              item: { select: { itemName: true } },
            },
          },
          performedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.maintenanceLog.count({ where }),
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
    const log = await prisma.maintenanceLog.findUnique({
      where: { id },
      include: {
        equipment: {
          include: {
            item: { select: { itemName: true } },
          },
        },
        performedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!log || log.equipment.deletedAt) {
      throw new Error('Maintenance log not found');
    }

    return log;
  }

  static async schedule(
    id: number,
    data: ScheduleMaintenanceInput,
    userId: number,
  ) {
    const log = await this.findOne(id);

    await this.assertNoActiveMaintenance(log.equipmentId, id);

    if (data.performedById) {
      const user = await prisma.user.findUnique({
        where: { id: data.performedById },
      });
      if (!user || user.deletedAt) {
        throw new Error('Assigned technician user not found');
      }
    }

    const updated = await prisma.maintenanceLog.update({
      where: { id },
      data: {
        description: data.description,
        scheduledDate: data.scheduledDate,
        performedById: data.performedById ?? null,
        performedByVendor: data.performedByVendor ?? null,
        notes: data.notes ?? null,
        status: MaintenanceStatus.SCHEDULED,
      },
      include: {
        equipment: {
          include: { item: { select: { itemName: true } } },
        },
        performedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await AuditLogService.log(
      'MaintenanceLog',
      id,
      LogAction.UPDATED,
      userId,
      log,
      updated,
    );

    return updated;
  }

  static async update(
    id: number,
    data: UpdateMaintenanceScheduleInput,
    userId: number,
  ) {
    const log = await this.findOne(id);

    await this.assertNoActiveMaintenance(log.equipmentId, id);

    if (data.performedById) {
      const user = await prisma.user.findUnique({
        where: { id: data.performedById },
      });
      if (!user || user.deletedAt) {
        throw new Error('Assigned technician user not found');
      }
    }

    // Determine audit action if transitioning status
    let auditAction: LogAction = LogAction.UPDATED;
    if (
      data.status === MaintenanceStatus.IN_PROGRESS &&
      log.status !== MaintenanceStatus.IN_PROGRESS
    ) {
      auditAction = LogAction.MAINTENANCE_STARTED;
    } else if (
      data.status === MaintenanceStatus.COMPLETED &&
      log.status !== MaintenanceStatus.COMPLETED
    ) {
      auditAction = LogAction.MAINTENANCE_COMPLETED;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedLog = await tx.maintenanceLog.update({
        where: { id },
        data: {
          description: data.description,
          scheduledDate: data.scheduledDate,
          performedById:
            data.performedById !== undefined ? data.performedById : undefined,
          performedByVendor:
            data.performedByVendor !== undefined
              ? data.performedByVendor
              : undefined,
          notes: data.notes,
          status: data.status,
          cost:
            data.cost !== undefined
              ? data.cost !== null
                ? new Prisma.Decimal(data.cost)
                : null
              : undefined,
          completedDate: data.completedDate,
        },
        include: {
          equipment: {
            include: { item: { select: { itemName: true } } },
          },
          performedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // Synchronize Equipment status if status transitions to IN_PROGRESS or COMPLETED
      if (data.status === MaintenanceStatus.IN_PROGRESS) {
        await tx.equipment.update({
          where: { id: log.equipmentId },
          data: { status: EquipmentStatus.UNDER_MAINTENANCE },
        });
      } else if (
        data.status === MaintenanceStatus.COMPLETED ||
        data.status === MaintenanceStatus.CANCELLED
      ) {
        // If completed or cancelled, transition equipment back to AVAILABLE
        await tx.equipment.update({
          where: { id: log.equipmentId },
          data: { status: EquipmentStatus.AVAILABLE },
        });
      }

      return updatedLog;
    });

    await AuditLogService.log(
      'MaintenanceLog',
      id,
      auditAction,
      userId,
      log,
      updated,
    );

    return updated;
  }
}
