import { z } from 'zod';
import { BorrowStatus } from '@prisma/client';

// ── Create Borrow Request ─────────────────────────────────────────────────────

export const createBorrowSchema = z.object({
  equipmentId: z
    .number({ required_error: 'Equipment is required' })
    .int()
    .positive('Equipment ID must be a positive integer'),
  expectedReturn: z.coerce
    .date({ required_error: 'Expected return date is required' })
    .refine((d) => d > new Date(), {
      message: 'Expected return date must be in the future',
    }),
  notes: z.string().trim().max(1000).optional().nullable(),
});

// ── List Borrow Requests ──────────────────────────────────────────────────────

export const listBorrowQuerySchema = z.object({
  status: z.nativeEnum(BorrowStatus).optional(),
  equipmentId: z.coerce.number().int().positive().optional(),
  borrowedById: z.coerce.number().int().positive().optional(),
  /** When true, return only records belonging to the authenticated user */
  mine: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateBorrowInput = z.infer<typeof createBorrowSchema>;
export type ListBorrowQuery = z.infer<typeof listBorrowQuerySchema>;
