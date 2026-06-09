import { z } from 'zod';

export const queryUsersSchema = z.object({
  page: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().int().min(1).optional(),
  ),
  limit: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().int().min(1).optional(),
  ),
  search: z.string().optional(),
  roleId: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().int().optional(),
  ),
  isActive: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }, z.boolean().optional()),
});

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address').max(255),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long')
    .max(255),
  roleId: z.number().int('Role ID must be an integer'),
  isActive: z.boolean().optional().default(true),
});

export const updateUserAccessSchema = z.object({
  roleId: z.number().int('Role ID must be an integer').optional(),
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(100).optional(),
  email: z.string().trim().email('Invalid email address').max(255).optional(),
  roleId: z.number().int('Role ID must be an integer').optional(),
  isActive: z.boolean().optional(),
});

export type QueryUsersInput = z.infer<typeof queryUsersSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserAccessInput = z.infer<typeof updateUserAccessSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
