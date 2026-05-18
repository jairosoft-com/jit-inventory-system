// ============================================
// JIT IMS — Shared Constants
// Centralized constants used across the system
// ============================================

// ── System Roles ────────────────────────────
export const SYSTEM_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

// ── Permission Strings ──────────────────────
// Convention: resource:action
export const PERMISSIONS = {
  // Inventory
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',

  // Equipment
  EQUIPMENT_CREATE: 'equipment:create',
  EQUIPMENT_READ: 'equipment:read',
  EQUIPMENT_UPDATE: 'equipment:update',
  EQUIPMENT_DELETE: 'equipment:delete',

  // Borrow
  BORROW_SUBMIT: 'borrow:submit',
  BORROW_APPROVE: 'borrow:approve',
  BORROW_READ: 'borrow:read',

  // Disposal
  DISPOSAL_APPROVE: 'disposal:approve',
  DISPOSAL_READ: 'disposal:read',

  // Users
  USERS_MANAGE: 'users:manage',
  USERS_READ: 'users:read',

  // Roles
  ROLES_MANAGE: 'roles:manage',
  ROLES_READ: 'roles:read',

  // Categories
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_READ: 'categories:read',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',

  // Suppliers
  SUPPLIERS_CREATE: 'suppliers:create',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_UPDATE: 'suppliers:update',

  // Purchase Orders
  PURCHASE_ORDERS_CREATE: 'purchase_orders:create',
  PURCHASE_ORDERS_READ: 'purchase_orders:read',
  PURCHASE_ORDERS_UPDATE: 'purchase_orders:update',

  // Stock Movement
  STOCK_IN_CREATE: 'stock_in:create',
  STOCK_OUT_CREATE: 'stock_out:create',
  STOCK_READ: 'stock:read',

  // Maintenance
  MAINTENANCE_CREATE: 'maintenance:create',
  MAINTENANCE_READ: 'maintenance:read',
  MAINTENANCE_UPDATE: 'maintenance:update',

  // Audit Logs
  AUDIT_LOGS_READ: 'audit_logs:read',

  // Reports
  REPORTS_EXPORT: 'reports:export',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ── API Response Shape ──────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── File Upload Constraints ─────────────────
export const FILE_UPLOAD = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf'],
} as const;
