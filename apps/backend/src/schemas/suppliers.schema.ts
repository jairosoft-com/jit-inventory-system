import { z } from 'zod';

export const createSupplierSchema = z.object({
  supplierName: z.string().trim().min(1, 'Supplier name is required').max(255),
  contactPerson: z
    .string()
    .trim()
    .min(1, 'Contact person is required')
    .max(255),
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Invalid email address')
    .max(255),
  phone: z.string().trim().min(1, 'Phone number is required').max(50),
  address: z.string().trim().min(1, 'Business address is required'),
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
    .min(1, 'Contact person is required')
    .max(255)
    .optional(),
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Invalid email address')
    .max(255)
    .optional(),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .max(50)
    .optional(),
  address: z.string().trim().min(1, 'Business address is required').optional(),
});

export const listSuppliersQuerySchema = z.object({
  includeArchived: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .default(false),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
