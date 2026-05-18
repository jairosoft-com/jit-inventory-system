import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify required permissions for a route handler.
 * Used in conjunction with RolesGuard to enforce DB-driven RBAC.
 *
 * @example
 * @RequirePermissions('inventory:create', 'inventory:update')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async createItem() { ... }
 */
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
