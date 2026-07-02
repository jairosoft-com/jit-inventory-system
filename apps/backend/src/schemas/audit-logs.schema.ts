import { z } from 'zod';
import { LogAction } from '@prisma/client';

export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.coerce.number().int().positive().optional(),
  action: z.nativeEnum(LogAction).optional(),
  performedBy: z.coerce.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z
    .string()
    .default('1')
    .transform((v) => Math.max(1, parseInt(v, 10))),
  limit: z
    .string()
    .default('25')
    .transform((v) => Math.min(100, Math.max(1, parseInt(v, 10)))),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

