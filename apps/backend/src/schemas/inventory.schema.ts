import { z } from 'zod';
import { AdjustmentReason, MovementType } from '@prisma/client';

// ── Stock In ──────────────────────────────────────────────────────────────────

export const stockInSchema = z.object({
  consumableProfileId: z
    .number()
    .int()
    .positive('Consumable profile ID must be a positive integer'),
  quantityAdded: z
    .number()
    .int()
    .positive('Quantity added must be a positive integer'),
  purchaseOrderId: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// ── Stock Out ─────────────────────────────────────────────────────────────────

export const stockOutSchema = z.object({
  consumableProfileId: z
    .number()
    .int()
    .positive('Consumable profile ID must be a positive integer'),
  quantityRemoved: z
    .number()
    .int()
    .positive('Quantity removed must be a positive integer'),
  purpose: z.string().trim().min(1, 'Purpose is required').max(2000),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// ── Stock Adjustment ──────────────────────────────────────────────────────────
// Either provide `newQuantity` (absolute target) OR `quantityChange` (relative
// delta, positive or negative). Exactly one must be provided.

export const stockAdjustmentSchema = z
  .object({
    consumableProfileId: z
      .number()
      .int()
      .positive('Consumable profile ID must be a positive integer'),
    newQuantity: z.number().int().min(0).optional(),
    quantityChange: z
      .number()
      .int()
      .refine((val) => val !== 0, {
        message: 'Quantity change cannot be zero',
      })
      .optional(),
    reason: z.nativeEnum(AdjustmentReason, {
      errorMap: () => ({ message: 'A valid adjustment reason is required' }),
    }),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine(
    (data) =>
      (data.newQuantity !== undefined) !== (data.quantityChange !== undefined),
    {
      message: 'Provide exactly one of "newQuantity" or "quantityChange"',
      path: ['newQuantity'],
    },
  );

// ── List Movements Query ──────────────────────────────────────────────────────

export const listMovementsQuerySchema = z.object({
  consumableProfileId: z.coerce.number().int().positive().optional(),
  movementType: z.nativeEnum(MovementType).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type StockInInput = z.infer<typeof stockInSchema>;
export type StockOutInput = z.infer<typeof stockOutSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
