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

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100).optional(),
  type: z.nativeEnum(ItemType, {
    errorMap: () => ({
      message: 'Invalid category type. Allowed: EQUIPMENT, CONSUMABLE, DIGITAL',
    }),
  }).optional(),
  description: z.string().optional().nullable(),
});

export const listCategoriesQuerySchema = z.object({
  includeArchived: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .default(false),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
