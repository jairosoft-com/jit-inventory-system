import { z } from 'zod';
import {
  EquipmentStatus,
  ConditionStatus,
  DisposalReason,
} from '@prisma/client';

// ── Image sub-schema ──────────────────────────────────────────────────────────

export const equipmentImageSchema = z.object({
  url: z.string().min(1, 'Image data is required'),
  label: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
});

export const updateImageSchema = z.object({
  label: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().optional(),
});

// ── Equipment schemas ─────────────────────────────────────────────────────────

export const createEquipmentSchema = z.object({
  // Item fields
  itemName: z.string().trim().min(1, 'Item name is required').max(255),
  description: z.string().trim().optional().nullable(),
  categoryId: z
    .number()
    .int()
    .positive('Category ID must be a positive integer'),
  barcode: z.string().trim().max(255).optional().nullable(),

  // Equipment fields
  assetId: z.string().trim().min(1, 'Asset ID is required').max(100),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  brand: z.string().trim().max(255).optional().nullable(),
  model: z.string().trim().max(255).optional().nullable(),
  condition: z.nativeEnum(ConditionStatus).optional().default('NEW'),
  status: z.nativeEnum(EquipmentStatus).optional().default('AVAILABLE'),
  location: z.string().trim().max(255).optional().nullable(),
  assignedTo: z.number().int().positive().optional().nullable(),
  purchaseOrderId: z.number().int().positive().optional().nullable(),
  acquisitionDate: z.coerce.date().optional().nullable(),
  purchasePrice: z.number().positive().optional().nullable(),
  warrantyStart: z.coerce.date().optional().nullable(),
  warrantyEnd: z.coerce.date().optional().nullable(),
  warrantyProvider: z.string().trim().max(255).optional().nullable(),
  warrantyDocUrl: z.string().url().max(500).optional().nullable(),

  // Images
  images: z.array(equipmentImageSchema).optional().default([]),
});

export const updateEquipmentSchema = z
  .object({
    // Item fields
    itemName: z.string().trim().min(1).max(255),
    description: z.string().trim().optional().nullable(),
    categoryId: z.number().int().positive(),
    barcode: z.string().trim().max(255).optional().nullable(),

    // Equipment fields
    assetId: z.string().trim().min(1).max(100),
    serialNumber: z.string().trim().max(100).optional().nullable(),
    brand: z.string().trim().max(255).optional().nullable(),
    model: z.string().trim().max(255).optional().nullable(),
    condition: z.nativeEnum(ConditionStatus),
    status: z.nativeEnum(EquipmentStatus),
    location: z.string().trim().max(255).optional().nullable(),
    assignedTo: z.number().int().positive().optional().nullable(),
    purchaseOrderId: z.number().int().positive().optional().nullable(),
    acquisitionDate: z.coerce.date().optional().nullable(),
    purchasePrice: z.number().positive().optional().nullable(),
    warrantyStart: z.coerce.date().optional().nullable(),
    warrantyEnd: z.coerce.date().optional().nullable(),
    warrantyProvider: z.string().trim().max(255).optional().nullable(),
    warrantyDocUrl: z.string().url().max(500).optional().nullable(),
  })
  .partial();

export const retirementRequestSchema = z.object({
  reason: z.nativeEnum(DisposalReason, {
    required_error: 'Disposal reason is required',
  }),
  method: z
    .string({ required_error: 'Disposal method is required' })
    .trim()
    .min(1, 'Disposal method is required')
    .max(100, 'Disposal method must be 100 characters or less'),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const replacementNeededSchema = z.object({
  replacementNeeded: z.boolean(),
});

export const listEquipmentQuerySchema = z.object({
  status: z.nativeEnum(EquipmentStatus).optional(),
  condition: z.nativeEnum(ConditionStatus).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  assignedTo: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
export type RetirementRequestInput = z.infer<typeof retirementRequestSchema>;
export type ReplacementNeededInput = z.infer<typeof replacementNeededSchema>;
export type EquipmentImageInput = z.infer<typeof equipmentImageSchema>;
export type UpdateImageInput = z.infer<typeof updateImageSchema>;
export type ListEquipmentQuery = z.infer<typeof listEquipmentQuerySchema>;
