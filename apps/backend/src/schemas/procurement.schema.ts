import { z } from 'zod';

// ── Create Purchase Order ────────────────────────────────────────────────────
export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive('Supplier ID is required'),
  invoiceNumber: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .or(z.literal('')),
  lineItems: z
    .array(
      z.object({
        itemId: z.number().int().positive('Item ID is required'),
        quantity: z.number().int().positive('Quantity must be at least 1'),
        unitCost: z.number().positive('Unit cost must be greater than 0'),
      }),
    )
    .min(1, 'At least one line item is required'),
});

// ── Update Purchase Order (Draft only) ───────────────────────────────────────
export const updatePurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive().optional(),
  invoiceNumber: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .or(z.literal('')),
  lineItems: z
    .array(
      z.object({
        itemId: z.number().int().positive('Item ID is required'),
        quantity: z.number().int().positive('Quantity must be at least 1'),
        unitCost: z.number().positive('Unit cost must be greater than 0'),
      }),
    )
    .min(1, 'At least one line item is required')
    .optional(),
});

// ── Update PO Status ─────────────────────────────────────────────────────────
export const updatePurchaseOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'APPROVED',
    'REJECTED',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
  ]),
  notes: z.string().trim().max(500).optional(),
});

// ── List Query ───────────────────────────────────────────────────────────────
export const listPurchaseOrdersQuerySchema = z.object({
  status: z
    .enum([
      'DRAFT',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'COMPLETED',
      'CANCELLED',
      'ARCHIVED',
    ])
    .optional(),
  includeArchived: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .default(false),
});

// ── Attachment ───────────────────────────────────────────────────────────────
export const addAttachmentSchema = z.object({
  fileUrl: z
    .string()
    .trim()
    .min(1, 'File URL is required')
    .refine(
      (val) => {
        const allowedTypes = [
          'data:image/jpeg',
          'data:image/jpg',
          'data:image/png',
        ];
        return (
          allowedTypes.some((type) => val.startsWith(type)) ||
          /\.(jpg|jpeg|png)$/i.test(val)
        );
      },
      {
        message:
          'Unsupported file type. Only JPG, JPEG, and PNG files are allowed.',
      },
    )
    .refine(
      (val) => {
        if (val.startsWith('data:')) {
          const base64Data = val.split(',')[1];
          if (!base64Data) return false;
          const size = Math.round((base64Data.length * 3) / 4);
          return size <= 5 * 1024 * 1024;
        }
        return true;
      },
      { message: 'Your image exceeds the 5MB limit.' },
    ),
  fileName: z.string().trim().min(1, 'File name is required').max(255),
  fileSize: z
    .number()
    .int()
    .positive()
    .optional()
    .refine((val) => !val || val <= 5 * 1024 * 1024, {
      message: 'Your image exceeds the 5MB limit.',
    }),
});

// ── Export types ─────────────────────────────────────────────────────────────
export type CreatePurchaseOrderInput = z.infer<
  typeof createPurchaseOrderSchema
>;
export type UpdatePurchaseOrderInput = z.infer<
  typeof updatePurchaseOrderSchema
>;
export type UpdatePurchaseOrderStatusInput = z.infer<
  typeof updatePurchaseOrderStatusSchema
>;
export type ListPurchaseOrdersQuery = z.infer<
  typeof listPurchaseOrdersQuerySchema
>;
export type AddAttachmentInput = z.infer<typeof addAttachmentSchema>;
