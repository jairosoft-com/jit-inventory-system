import { z } from 'zod';

export const supplierStatusFilterSchema = z
  .enum(['all', 'active', 'inactive'])
  .default('active');

export const listSuppliersQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  status: supplierStatusFilterSchema,
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type SupplierStatusFilter = z.infer<typeof supplierStatusFilterSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
