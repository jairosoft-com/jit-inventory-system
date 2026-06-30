import { z } from 'zod';

export const REPORT_TYPES = [
  'inventory',
  'procurement',
  'borrowing',
  'maintenance',
  'disposal',
  'employee_equipment',
  'low_stock',
] as const;

// ── Shared date coercion helper ───────────────────────────────────────────────
// Accepts 'yyyy-MM-dd' strings and converts to a Date set to start-of-day UTC.
// Returns undefined cleanly when the param is absent.

const dateStringSchema = z
  .union([z.string().length(0), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in yyyy-MM-dd format')])
  .transform((val) => (val === '' ? undefined : new Date(`${val}T00:00:00.000Z`)))
  .optional();

// ── Query schema (shared by /preview, /export/excel, /export/pdf) ─────────────

export const reportQuerySchema = z.object({
  type: z.enum(REPORT_TYPES, {
    errorMap: () => ({
      message: `Invalid report type. Must be one of: ${REPORT_TYPES.join(', ')}`,
    }),
  }),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  categoryId: z
    .string()
    .regex(/^\d+$/, 'categoryId must be a numeric string')
    .transform((val) => parseInt(val, 10))
    .optional(),
});

// Keep the old name as an alias so the /types route import doesn't break
export const reportTypeQuerySchema = reportQuerySchema;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReportTypeQuery = z.infer<typeof reportQuerySchema>;

export type ReportFilters = {
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
};
