import { prisma } from '../lib/prisma.js';
import {
  MaintenanceStatus,
  LogAction,
  EquipmentStatus,
  Prisma,
  ConditionStatus,
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
      include: { item: { select: { itemName: true } } },
    });

    if (!equipment || equipment.deletedAt) {
      throw new Error('Equipment not found');
    }

    await this.assertNoActiveMaintenance(data.equipmentId);

    try {
      const log = await prisma.maintenanceLog.create({
        data: {
          equipmentId: data.equipmentId,
          description: data.description,
          status: MaintenanceStatus.SCHEDULED,
          scheduledDate: null,
          equipmentName: equipment.item?.itemName ?? null,
          equipmentBrand: equipment.brand,
          equipmentModel: equipment.model,
          equipmentCondition: equipment.condition,
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error(
          'Equipment already has an active/open maintenance record',
        );
      }
      throw error;
    }
  }

  static async findAll(query: ListMaintenanceLogsQuery) {
    const { status, equipmentId, search, tab, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MaintenanceLogWhereInput = {
      equipment: {
        deletedAt: null,
      },
    };

    if (tab === 'upcoming') {
      where.status = {
        in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS],
      };
      where.scheduledDate = {
        not: null,
      };
    } else if (tab === 'history') {
      where.status = {
        in: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
      };
    } else {
      if (status) {
        where.status = status;
      }
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

    // Determine ordering chronologically
    let orderBy: Prisma.MaintenanceLogOrderByWithRelationInput[] = [
      { scheduledDate: 'desc' },
      { createdAt: 'desc' },
    ];

    if (tab === 'upcoming') {
      orderBy = [
        { scheduledDate: 'asc' }, // closest scheduled date first
        { createdAt: 'asc' },
      ];
    } else if (tab === 'history') {
      orderBy = [
        { completedDate: 'desc' }, // recently completed first
        { updatedAt: 'desc' },
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
        orderBy,
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

    try {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error(
          'Equipment already has an active/open maintenance record',
        );
      }
      throw error;
    }
  }

  static async update(
    id: number,
    data: UpdateMaintenanceScheduleInput,
    userId: number,
  ) {
    const log = (await this.findOne(id)) as Prisma.MaintenanceLogGetPayload<{
      include: {
        equipment: {
          include: {
            item: { select: { itemName: true } };
          };
        };
      };
    }>;

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

    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Prepare log update data
        const logUpdateData: Prisma.MaintenanceLogUpdateInput & {
          equipmentName?: string | null;
          equipmentBrand?: string | null;
          equipmentModel?: string | null;
          equipmentCondition?: ConditionStatus | null;
        } = {
          description: data.description,
          scheduledDate: data.scheduledDate,
          performedBy:
            data.performedById !== undefined
              ? data.performedById
                ? { connect: { id: data.performedById } }
                : { disconnect: true }
              : undefined,
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
        };

        // Snapshot equipment details on completion
        if (data.status === MaintenanceStatus.COMPLETED) {
          logUpdateData.equipmentName =
            log.equipmentName || log.equipment.item?.itemName;
          logUpdateData.equipmentBrand =
            log.equipmentBrand || log.equipment.brand;
          logUpdateData.equipmentModel =
            log.equipmentModel || log.equipment.model;
          logUpdateData.equipmentCondition =
            data.postMaintenanceCondition ||
            log.equipmentCondition ||
            log.equipment.condition;
        }

        const updatedLog = await tx.maintenanceLog.update({
          where: { id },
          data: logUpdateData,
          include: {
            equipment: {
              include: { item: { select: { itemName: true } } },
            },
            performedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        // Synchronize Equipment status and condition if status transitions
        if (data.status === MaintenanceStatus.IN_PROGRESS) {
          await tx.equipment.update({
            where: { id: log.equipmentId },
            data: { status: EquipmentStatus.UNDER_MAINTENANCE },
          });
        } else if (data.status === MaintenanceStatus.COMPLETED) {
          const nextCondition =
            data.postMaintenanceCondition || log.equipment.condition;

          await tx.equipment.update({
            where: { id: log.equipmentId },
            data: {
              status: EquipmentStatus.AVAILABLE,
              condition: nextCondition,
            },
          });

          // Automatically spawn a new unscheduled maintenance log slot if the completed equipment
          // remains in non-healthy status to ensure tracking is not lost.
          if (
            nextCondition !== ConditionStatus.NEW &&
            nextCondition !== ConditionStatus.GOOD
          ) {
            await tx.maintenanceLog.create({
              data: {
                equipmentId: log.equipmentId,
                description: `Follow-up maintenance needed — Equipment in ${nextCondition} condition`,
                status: MaintenanceStatus.SCHEDULED,
                scheduledDate: null,
                equipmentName: log.equipment.item?.itemName,
                equipmentBrand: log.equipment.brand,
                equipmentModel: log.equipment.model,
                equipmentCondition: nextCondition,
              },
            });
          }
        } else if (data.status === MaintenanceStatus.CANCELLED) {
          // Only revert to AVAILABLE if equipment is currently UNDER_MAINTENANCE
          // (meaning this maintenance session was started and is now cancelled).
          // Otherwise, leave status untouched (e.g. DAMAGED, RETIREMENT_PENDING).
          const currentEquipment = await tx.equipment.findUnique({
            where: { id: log.equipmentId },
            select: { status: true },
          });
          if (currentEquipment?.status === EquipmentStatus.UNDER_MAINTENANCE) {
            await tx.equipment.update({
              where: { id: log.equipmentId },
              data: { status: EquipmentStatus.AVAILABLE },
            });
          }
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error(
          'Equipment already has an active/open maintenance record',
        );
      }
      throw error;
    }
  }

  static async getStats() {
    const [total, unscheduled, scheduled, inProgress, completed] =
      await Promise.all([
        prisma.maintenanceLog.count({
          where: { equipment: { deletedAt: null } },
        }),
        prisma.maintenanceLog.count({
          where: {
            equipment: { deletedAt: null },
            scheduledDate: null,
            status: MaintenanceStatus.SCHEDULED,
          },
        }),
        prisma.maintenanceLog.count({
          where: {
            equipment: { deletedAt: null },
            status: MaintenanceStatus.SCHEDULED,
            scheduledDate: { not: null },
          },
        }),
        prisma.maintenanceLog.count({
          where: {
            equipment: { deletedAt: null },
            status: MaintenanceStatus.IN_PROGRESS,
          },
        }),
        prisma.maintenanceLog.count({
          where: {
            equipment: { deletedAt: null },
            status: MaintenanceStatus.COMPLETED,
          },
        }),
      ]);

    return { total, unscheduled, scheduled, inProgress, completed };
  }
}
