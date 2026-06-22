import { z } from 'zod';

export const createSupplierSchema = z.object({
  supplierName: z.string().trim().min(1, 'Supplier name is required').max(255),
  contactPerson: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional()
    .or(z.literal('')),
  email: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.string().trim().email('Invalid email address').max(255).nullable(),
    )
    .optional(),
  phone: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  address: z.string().trim().nullable().optional().or(z.literal('')),
});

export const updateSupplierSchema = z.object({
  supplierName: z
    .string()
    .trim()
    .min(1, 'Supplier name is required')
    .max(255)
    .optional(),
  contactPerson: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional()
    .or(z.literal('')),
  email: z
    .preprocess(
      (val) => (val === '' ? null : val),
      z.string().trim().email('Invalid email address').max(255).nullable(),
    )
    .optional(),
  phone: z.string().trim().max(50).nullable().optional().or(z.literal('')),
  address: z.string().trim().nullable().optional().or(z.literal('')),
});

export const supplierStatusFilterSchema = z
  .enum(['all', 'active', 'inactive'])
  .default('active');

export const listSuppliersQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  status: supplierStatusFilterSchema,
  includeArchived: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierStatusFilter = z.infer<typeof supplierStatusFilterSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
