// ============================================
// JIT IMS — RBAC Seed Data
// Seeds roles, permissions, and role_permissions
// on first migration as defined in v3.1 spec
// ============================================

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Seeded Roles ────────────────────────────
const ROLES = [
  { name: 'ADMIN', description: 'Full system access — unrestricted', isSystem: true },
  {
    name: 'MANAGER',
    description: 'Operational authority — inventory and borrow management',
    isSystem: true,
  },
  { name: 'STAFF', description: 'End-user access — browse and self-request only', isSystem: true },
];

// ── Seeded Permissions ──────────────────────
// Convention: resource:action
const PERMISSIONS = [
  // Inventory
  {
    name: 'inventory:create',
    resource: 'inventory',
    action: 'create',
    description: 'Create inventory items',
  },
  {
    name: 'inventory:read',
    resource: 'inventory',
    action: 'read',
    description: 'View inventory items',
  },
  {
    name: 'inventory:update',
    resource: 'inventory',
    action: 'update',
    description: 'Update inventory items',
  },
  {
    name: 'inventory:delete',
    resource: 'inventory',
    action: 'delete',
    description: 'Delete/archive inventory items',
  },

  // Equipment
  {
    name: 'equipment:create',
    resource: 'equipment',
    action: 'create',
    description: 'Register equipment',
  },
  {
    name: 'equipment:read',
    resource: 'equipment',
    action: 'read',
    description: 'View equipment details',
  },
  {
    name: 'equipment:update',
    resource: 'equipment',
    action: 'update',
    description: 'Update equipment records',
  },
  {
    name: 'equipment:delete',
    resource: 'equipment',
    action: 'delete',
    description: 'Delete/archive equipment',
  },

  // Borrow
  {
    name: 'borrow:submit',
    resource: 'borrow',
    action: 'create',
    description: 'Submit borrow requests',
  },
  {
    name: 'borrow:approve',
    resource: 'borrow',
    action: 'approve',
    description: 'Approve/reject borrow requests',
  },
  { name: 'borrow:read', resource: 'borrow', action: 'read', description: 'View borrow records' },

  // Disposal
  {
    name: 'disposal:approve',
    resource: 'disposal',
    action: 'approve',
    description: 'Approve equipment disposal',
  },
  {
    name: 'disposal:read',
    resource: 'disposal',
    action: 'read',
    description: 'View disposal records',
  },

  // Users
  {
    name: 'users:manage',
    resource: 'users',
    action: 'create',
    description: 'Create and manage user accounts',
  },
  { name: 'users:read', resource: 'users', action: 'read', description: 'View user profiles' },

  // Roles & Permissions
  {
    name: 'roles:manage',
    resource: 'roles',
    action: 'update',
    description: 'Manage roles and permissions',
  },
  {
    name: 'roles:read',
    resource: 'roles',
    action: 'read',
    description: 'View roles and permissions',
  },

  // Categories
  {
    name: 'categories:create',
    resource: 'categories',
    action: 'create',
    description: 'Create categories',
  },
  {
    name: 'categories:read',
    resource: 'categories',
    action: 'read',
    description: 'View categories',
  },
  {
    name: 'categories:update',
    resource: 'categories',
    action: 'update',
    description: 'Update categories',
  },
  {
    name: 'categories:delete',
    resource: 'categories',
    action: 'delete',
    description: 'Delete categories',
  },

  // Suppliers
  {
    name: 'suppliers:create',
    resource: 'suppliers',
    action: 'create',
    description: 'Create supplier records',
  },
  {
    name: 'suppliers:read',
    resource: 'suppliers',
    action: 'read',
    description: 'View supplier records',
  },
  {
    name: 'suppliers:update',
    resource: 'suppliers',
    action: 'update',
    description: 'Update supplier records',
  },

  // Purchase Orders
  {
    name: 'purchase_orders:create',
    resource: 'purchase_orders',
    action: 'create',
    description: 'Create purchase orders',
  },
  {
    name: 'purchase_orders:read',
    resource: 'purchase_orders',
    action: 'read',
    description: 'View purchase orders',
  },
  {
    name: 'purchase_orders:update',
    resource: 'purchase_orders',
    action: 'update',
    description: 'Update purchase orders',
  },

  // Stock Movement
  {
    name: 'stock_in:create',
    resource: 'stock_in',
    action: 'create',
    description: 'Record stock in',
  },
  {
    name: 'stock_out:create',
    resource: 'stock_out',
    action: 'create',
    description: 'Record stock out',
  },
  { name: 'stock:read', resource: 'stock', action: 'read', description: 'View stock movements' },

  // Maintenance
  {
    name: 'maintenance:create',
    resource: 'maintenance',
    action: 'create',
    description: 'Create maintenance logs',
  },
  {
    name: 'maintenance:read',
    resource: 'maintenance',
    action: 'read',
    description: 'View maintenance logs',
  },
  {
    name: 'maintenance:update',
    resource: 'maintenance',
    action: 'update',
    description: 'Update maintenance logs',
  },

  // Audit Logs
  {
    name: 'audit_logs:read',
    resource: 'audit_logs',
    action: 'read',
    description: 'View audit trail',
  },

  // Reports
  {
    name: 'reports:export',
    resource: 'reports',
    action: 'read',
    description: 'Generate and export reports',
  },
];

// ── Role-Permission Mappings ────────────────
// Based on Access Control Matrix from v3.1 spec
const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  ADMIN: [
    // Admin has ALL permissions
    'inventory:create',
    'inventory:read',
    'inventory:update',
    'inventory:delete',
    'equipment:create',
    'equipment:read',
    'equipment:update',
    'equipment:delete',
    'borrow:submit',
    'borrow:approve',
    'borrow:read',
    'disposal:approve',
    'disposal:read',
    'users:manage',
    'users:read',
    'roles:manage',
    'roles:read',
    'categories:create',
    'categories:read',
    'categories:update',
    'categories:delete',
    'suppliers:create',
    'suppliers:read',
    'suppliers:update',
    'purchase_orders:create',
    'purchase_orders:read',
    'purchase_orders:update',
    'stock_in:create',
    'stock_out:create',
    'stock:read',
    'maintenance:create',
    'maintenance:read',
    'maintenance:update',
    'audit_logs:read',
    'reports:export',
  ],
  MANAGER: [
    'inventory:create',
    'inventory:read',
    'inventory:update',
    'equipment:create',
    'equipment:read',
    'equipment:update',
    'borrow:submit',
    'borrow:approve',
    'borrow:read',
    'disposal:read',
    'users:read',
    'roles:read',
    'categories:create',
    'categories:read',
    'categories:update',
    'suppliers:create',
    'suppliers:read',
    'suppliers:update',
    'purchase_orders:create',
    'purchase_orders:read',
    'purchase_orders:update',
    'stock_in:create',
    'stock_out:create',
    'stock:read',
    'maintenance:create',
    'maintenance:read',
    'maintenance:update',
    'audit_logs:read',
    'reports:export',
  ],
  STAFF: ['inventory:read', 'equipment:read', 'borrow:submit', 'borrow:read', 'categories:read'],
};

async function main() {
  console.warn('🌱 Seeding JIT IMS database...\n');

  // Seed roles
  console.warn('📋 Seeding roles...');
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.warn(`   ✓ ${ROLES.length} roles seeded\n`);

  // Seed permissions
  console.warn('🔐 Seeding permissions...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
  }
  console.warn(`   ✓ ${PERMISSIONS.length} permissions seeded\n`);

  // Seed role-permission mappings
  console.warn('🔗 Seeding role-permission mappings...');
  let mappingCount = 0;
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    for (const permName of permissionNames) {
      const permission = await prisma.permission.findUnique({ where: { name: permName } });
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
      mappingCount++;
    }
  }
  console.warn(`   ✓ ${mappingCount} role-permission mappings seeded\n`);

  // Seed default admin user
  if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEFAULT_ADMIN === 'true') {
    console.warn('👤 Seeding default admin user...');
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (adminRole) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@jitims.com';
      const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
        await prisma.user.create({
          data: {
            email: adminEmail,
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            roleId: adminRole.id,
            isActive: true,
          },
        });
        console.warn('   ✓ Default admin user seeded\n');
      } else {
        console.warn('   ✓ Admin user already exists\n');
      }
    }
  } else {
    console.warn(
      '   ○ Skipping default admin user in production. Use environment variables if needed.\n',
    );
  }

  console.warn('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
