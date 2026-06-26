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

// ── Query schema (shared by /preview, /export/excel, /export/pdf) ─────────────

export const reportTypeQuerySchema = z.object({
  type: z.enum(REPORT_TYPES, {
    errorMap: () => ({
      message: `Invalid report type. Must be one of: ${REPORT_TYPES.join(', ')}`,
    }),
  }),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReportTypeQuery = z.infer<typeof reportTypeQuerySchema>;