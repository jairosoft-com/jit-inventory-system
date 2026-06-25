import { z } from 'zod';

// ── Query: GET /notifications ─────────────────────────────────────────────────

export const listNotificationsQuerySchema = z.object({
  unresolved: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;