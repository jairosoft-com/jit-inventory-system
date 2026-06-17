import { z } from 'zod';
import {
  ItemType,
  DigitalAssetType,
  BillingCycle,
  DigitalStatus,
} from '@prisma/client';

// ── Image sub-schemas (mirroring equipment image schema) ─────────────────────

export const itemImageSchema = z.object({
  url: z.string().min(1, 'Image data is required'),
  label: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
});

export const updateItemImageSchema = z.object({
  label: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().optional(),
});

// ── Consumable sub-schema ─────────────────────────────────────────────────────

const consumableProfileSchema = z.object({
  unit: z.string().trim().min(1, 'Unit is required').max(50),
  quantity: z.number().int().min(0).optional().default(0),
  reorderPoint: z.number().int().min(0).optional().default(0),
});

// ── Digital asset sub-schema ──────────────────────────────────────────────────

const digitalAssetSchema = z.object({
  assetType: z.nativeEnum(DigitalAssetType, {
    errorMap: () => ({ message: 'Invalid digital asset type' }),
  }),
  url: z.string().url().max(500).optional().nullable(),
  vendor: z.string().trim().max(255).optional().nullable(),
  licenseKey: z.string().trim().optional().nullable(),
  credentialsRef: z.string().trim().max(255).optional().nullable(),
  seats: z.number().int().positive().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  cost: z.number().positive().optional().nullable(),
  billingCycle: z.nativeEnum(BillingCycle).optional().nullable(),
  status: z.nativeEnum(DigitalStatus).optional().default('ACTIVE'),
  notes: z.string().trim().optional().nullable(),
});

// ── Create schema (discriminated by itemType) ─────────────────────────────────

export const createItemSchema = z.discriminatedUnion('itemType', [
  // CONSUMABLE
  z.object({
    itemType: z.literal(ItemType.CONSUMABLE),
    itemName: z.string().trim().min(1, 'Item name is required').max(255),
    description: z.string().trim().optional().nullable(),
    categoryId: z
      .number()
      .int()
      .positive('Category ID must be a positive integer'),
    barcode: z.string().trim().max(255).optional().nullable(),
    imageUrl: z.string().url().max(500).optional().nullable(),
    consumableProfile: consumableProfileSchema,
  }),

  // DIGITAL
  z.object({
    itemType: z.literal(ItemType.DIGITAL),
    itemName: z.string().trim().min(1, 'Item name is required').max(255),
    description: z.string().trim().optional().nullable(),
    categoryId: z
      .number()
      .int()
      .positive('Category ID must be a positive integer'),
    barcode: z.string().trim().max(255).optional().nullable(),
    imageUrl: z.string().url().max(500).optional().nullable(),
    digitalAsset: digitalAssetSchema,
  }),
]);

// ── Update schema (flat partial — itemType cannot be changed) ─────────────────

export const updateItemSchema = z.object({
  itemName: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional().nullable(),
  categoryId: z.number().int().positive().optional(),
  barcode: z.string().trim().max(255).optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),

  // Consumable fields
  unit: z.string().trim().min(1).max(50).optional(),
  quantity: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),

  // Digital fields
  assetType: z.nativeEnum(DigitalAssetType).optional(),
  url: z.string().url().max(500).optional().nullable(),
  vendor: z.string().trim().max(255).optional().nullable(),
  licenseKey: z.string().trim().optional().nullable(),
  credentialsRef: z.string().trim().max(255).optional().nullable(),
  seats: z.number().int().positive().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  cost: z.number().positive().optional().nullable(),
  billingCycle: z.nativeEnum(BillingCycle).optional().nullable(),
  status: z.nativeEnum(DigitalStatus).optional(),
  notes: z.string().trim().optional().nullable(),
});

// ── List query schema ─────────────────────────────────────────────────────────

export const listItemsQuerySchema = z.object({
  itemType: z.nativeEnum(ItemType).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  includeArchived: z.coerce.boolean().optional().default(false),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
export type ItemImageInput = z.infer<typeof itemImageSchema>;
export type UpdateItemImageInput = z.infer<typeof updateItemImageSchema>;
