import { z } from 'zod';
import { BorrowStatus, ConditionStatus } from '@prisma/client';

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

// ── Reject Borrow Request ─────────────────────────────────────────────────────

export const rejectBorrowSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

// ── Return Equipment ──────────────────────────────────────────────────────────

export const returnEquipmentSchema = z.object({
  returnCondition: z.nativeEnum(ConditionStatus).optional(),
  notes: z.string().trim().max(1000).optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateBorrowInput = z.infer<typeof createBorrowSchema>;
export type ListBorrowQuery = z.infer<typeof listBorrowQuerySchema>;
export type RejectBorrowInput = z.infer<typeof rejectBorrowSchema>;
export type ReturnEquipmentInput = z.infer<typeof returnEquipmentSchema>;
