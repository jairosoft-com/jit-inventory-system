import { z } from 'zod';
import { ItemType } from '@prisma/client';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  type: z.nativeEnum(ItemType, {
    errorMap: () => ({
      message: 'Invalid category type. Allowed: EQUIPMENT, CONSUMABLE, DIGITAL',
    }),
  }),
  description: z.string().optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
