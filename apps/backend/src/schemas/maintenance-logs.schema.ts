import { z } from 'zod';
import { MaintenanceStatus, ConditionStatus } from '@prisma/client';

export const scheduleMaintenanceSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, 'Maintenance description is required'),
    scheduledDate: z.coerce.date().refine(
      (date) => {
        // Create a date comparison that resets milliseconds/seconds for stability in tests
        const now = new Date();
        now.setSeconds(0, 0);
        const scheduled = new Date(date);
        scheduled.setSeconds(0, 0);
        return scheduled >= now;
      },
      {
        message: 'Scheduled date must be in the future',
      },
    ),
    performedById: z.number().int().positive().optional().nullable(),
    performedByVendor: z.string().trim().max(255).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) =>
      data.performedById != null ||
      (data.performedByVendor != null && data.performedByVendor.length > 0),
    {
      message:
        'Either an assigned technician or a service provider/vendor must be specified',
      path: ['performedById'],
    },
  );

export const updateMaintenanceScheduleSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, 'Maintenance description is required')
      .optional(),
    scheduledDate: z.coerce
      .date()
      .refine(
        (date) => {
          const now = new Date();
          now.setSeconds(0, 0);
          const scheduled = new Date(date);
          scheduled.setSeconds(0, 0);
          return scheduled >= now;
        },
        {
          message: 'Scheduled date must be in the future',
        },
      )
      .optional(),
    performedById: z.number().int().positive().optional().nullable(),
    performedByVendor: z.string().trim().max(255).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    status: z.nativeEnum(MaintenanceStatus).optional(),
    cost: z.number().nonnegative().optional().nullable(),
    completedDate: z.coerce.date().optional().nullable(),
    postMaintenanceCondition: z.nativeEnum(ConditionStatus).optional(),
  })
  .refine(
    (data) => {
      // Only enforce if both are explicitly provided, or one is provided and the other is set to null
      const hasId = data.performedById !== undefined;
      const hasVendor = data.performedByVendor !== undefined;
      if (!hasId && !hasVendor) return true;

      const valId = data.performedById;
      const valVendor = data.performedByVendor;
      return valId != null || (valVendor != null && valVendor.length > 0);
    },
    {
      message:
        'Either an assigned technician or a service provider/vendor must be specified',
      path: ['performedById'],
    },
  );

export const listMaintenanceLogsQuerySchema = z.object({
  status: z.nativeEnum(MaintenanceStatus).optional(),
  equipmentId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  tab: z.enum(['upcoming', 'history', 'all']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createMaintenanceLogSchema = z.object({
  equipmentId: z.coerce.number().int().positive('Equipment ID is required'),
  description: z.string().trim().min(1, 'Description is required'),
});

export type ScheduleMaintenanceInput = z.infer<
  typeof scheduleMaintenanceSchema
>;
export type UpdateMaintenanceScheduleInput = z.infer<
  typeof updateMaintenanceScheduleSchema
>;
export type ListMaintenanceLogsQuery = z.infer<
  typeof listMaintenanceLogsQuerySchema
>;
export type CreateMaintenanceLogInput = z.infer<
  typeof createMaintenanceLogSchema
>;
