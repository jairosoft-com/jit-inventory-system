// ============================================
// JIT IMS — Comprehensive Seed Data
// Clears database and seeds: roles, permissions, users,
// suppliers, categories, consumables, equipment, digital assets,
// purchase orders, stock movements, borrow records, maintenance,
// disposals, inventory logs, and alerts.
// ============================================

import {
  PrismaClient,
  ItemType,
  ItemStatus,
  EquipmentStatus,
  ConditionStatus,
  BorrowStatus,
  PurchaseOrderStatus,
  DigitalAssetType,
  BillingCycle,
  DigitalStatus,
  DisposalReason,
  DisposalApprovalStatus,
  MaintenanceStatus,
  LogAction,
  AlertType,
  AlertPriority,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const ROLES = [
  { name: 'ADMIN', description: 'Full system access — unrestricted', isSystem: true },
  {
    name: 'MANAGER',
    description: 'Operational authority — inventory and borrow management',
    isSystem: true,
  },
  { name: 'STAFF', description: 'End-user access — browse and self-request only', isSystem: true },
];

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
  {
    name: 'borrow:return',
    resource: 'borrow',
    action: 'return',
    description: 'Process equipment returns',
  },

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
  {
    name: 'suppliers:delete',
    resource: 'suppliers',
    action: 'delete',
    description: 'Archive supplier records',
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
  {
    name: 'adjustment:create',
    resource: 'adjustment',
    action: 'create',
    description: 'Record inventory quantity adjustments',
  },
  {
    name: 'movement:read',
    resource: 'movement',
    action: 'read',
    description: 'View stock movement history',
  },

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

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.name),
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
    'borrow:return',
    'disposal:read',
    'users:read',
    'roles:read',
    'categories:create',
    'categories:read',
    'categories:update',
    'suppliers:create',
    'suppliers:read',
    'suppliers:update',
    'suppliers:delete',
    'purchase_orders:create',
    'purchase_orders:read',
    'purchase_orders:update',
    'stock_in:create',
    'stock_out:create',
    'stock:read',
    'adjustment:create',
    'movement:read',
    'maintenance:create',
    'maintenance:read',
    'maintenance:update',
    'audit_logs:read',
    'reports:export',
  ],
  STAFF: [
    'inventory:read',
    'equipment:read',
    'borrow:submit',
    'borrow:read',
    'categories:read',
    'purchase_orders:read',
    'purchase_orders:create',
    'purchase_orders:update',
    'suppliers:read',
  ],
};

async function main() {
  console.log('🧹 Clearing the database...');

  // Cascade truncate all tables to clean DB and restart PK auto-increments
  const tables = [
    'procurement_alerts',
    'inventory_alerts',
    'maintenance_alerts',
    'maintenance_logs',
    'borrow_records',
    'stock_movements',
    'stock_adjustments',
    'stock_out',
    'stock_in',
    'purchase_order_history',
    'purchase_order_attachments',
    'purchase_order_items',
    'disposals',
    'equipment_images',
    'equipment',
    'digital_assets',
    'item_images',
    'consumable_profiles',
    'items',
    'categories',
    'purchase_orders',
    'suppliers',
    'inventory_logs',
    'refresh_tokens',
    'users',
    'role_permissions',
    'permissions',
    'roles',
  ];

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
  );

  console.log('🌱 Seeding JIT IMS roles & permissions...\n');

  // ── Seed Roles ────────────────────────────
  for (const role of ROLES) {
    await prisma.role.create({ data: role });
  }
  console.log(`   ✓ ${ROLES.length} roles seeded`);

  // ── Seed Permissions ──────────────────────
  for (const permission of PERMISSIONS) {
    await prisma.permission.create({ data: permission });
  }
  console.log(`   ✓ ${PERMISSIONS.length} permissions seeded`);

  // ── Seed Role-Permission Mappings ─────────
  let mappingCount = 0;
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUnique({ where: { name: permissionName } });
      if (!permission) continue;

      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
      mappingCount++;
    }
  }
  console.log(`   ✓ ${mappingCount} role-permission mappings seeded\n`);

  // ── Seed Users ────────────────────────────
  console.log('👤 Seeding user accounts...');
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const managerRole = await prisma.role.findUnique({ where: { name: 'MANAGER' } });
  const staffRole = await prisma.role.findUnique({ where: { name: 'STAFF' } });

  if (!adminRole || !managerRole || !staffRole) {
    throw new Error('Roles must be seeded first');
  }

  // Superadmin credentials come from the environment so a fixed,
  // publicly-known password never ends up on a shared network.
  // If SEED_ADMIN_PASSWORD isn't set, generate a random one and print it
  // once — capture it now, it won't be shown again.
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || 'sam@jitims.com';
  const seedAdminPassword =
    process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('\n⚠️  SEED_ADMIN_PASSWORD not set — generated a random superadmin password:');
    console.log(`   Email:    ${seedAdminEmail}`);
    console.log(`   Password: ${seedAdminPassword}`);
    console.log('   Save this now — it will not be shown again.\n');
  }

  const superAdminPasswordHash = await bcrypt.hash(seedAdminPassword, 12);
  const commonPasswordHash = await bcrypt.hash('password123', 12);

  const superAdmin = await prisma.user.create({
    data: {
      firstName: 'Armelita',
      lastName: 'Pulido',
      email: seedAdminEmail,
      password: superAdminPasswordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      firstName: 'Maria',
      lastName: 'Manager',
      email: 'manager@jitims.com',
      password: commonPasswordHash,
      roleId: managerRole.id,
      isActive: true,
    },
  });

  const staff = await prisma.user.create({
    data: {
      firstName: 'Juan',
      lastName: 'Staff',
      email: 'staff@jitims.com',
      password: commonPasswordHash,
      roleId: staffRole.id,
      isActive: true,
    },
  });

  console.log('   ✓ User accounts seeded successfully');

  // ── Seed Suppliers ────────────────────────
  console.log('🏢 Seeding suppliers...');
  const suppliers = [
    {
      supplierName: 'TechPro Solutions',
      contactPerson: 'Carlos Reyes',
      email: 'carlos@techpro.ph',
      phone: '09171234567',
      address: '123 Ayala Ave, Makati City',
    },
    {
      supplierName: 'OfficeWorld PH',
      contactPerson: 'Ana Santos',
      email: 'ana@officeworld.ph',
      phone: '09289876543',
      address: '45 Shaw Blvd, Mandaluyong',
    },
    {
      supplierName: 'DataLink Corp',
      contactPerson: 'Ben Cruz',
      email: 'ben@datalink.ph',
      phone: '09501112233',
      address: '8 Bonifacio St, BGC Taguig',
    },
    {
      supplierName: 'QA Active Supplier Alpha 206417',
      contactPerson: 'Alpha Contact',
      email: 'alpha206417@example.com',
      phone: '09170000001',
      address: 'Davao City',
    },
    {
      supplierName: 'QA Active Supplier Beta 206417',
      contactPerson: 'Beta Contact',
      email: 'beta206417@example.com',
      phone: '09170000002',
      address: 'Davao City',
    },
    {
      supplierName: 'QA Inactive Supplier Gamma 206417',
      contactPerson: 'Gamma Contact',
      email: 'gamma206417@example.com',
      phone: '09170000003',
      address: 'Davao City',
      deletedAt: new Date(),
    },
  ];

  const seededSuppliers = [];
  for (const s of suppliers) {
    const item = await prisma.supplier.create({ data: s });
    seededSuppliers.push(item);
  }
  const [supTechPro, supOfficeWorld, supDataLink] = seededSuppliers;
  console.log(`   ✓ ${seededSuppliers.length} suppliers seeded`);

  // ── Seed Categories ───────────────────────
  console.log('📁 Seeding categories...');
  const categories = [
    { name: 'Laptops', type: ItemType.EQUIPMENT, description: 'Laptop computers' },
    { name: 'Peripherals', type: ItemType.EQUIPMENT, description: 'Keyboards, mice, monitors' },
    { name: 'Office Supplies', type: ItemType.CONSUMABLE, description: 'Paper, pens, folders' },
    { name: 'Networking', type: ItemType.EQUIPMENT, description: 'Routers, switches, cables' },
    { name: 'Printers', type: ItemType.EQUIPMENT, description: 'Inkjet and laser printers' },
  ];

  const seededCategories: Record<string, any> = {};
  for (const c of categories) {
    const item = await prisma.category.create({ data: c });
    seededCategories[c.name] = item;
  }
  console.log(`   ✓ ${Object.keys(seededCategories).length} categories seeded`);

  // ── Seed Consumable Items ─────────────────
  console.log('📦 Seeding consumable items...');
  const bondPaperItem = await prisma.item.create({
    data: {
      itemName: 'Bond Paper A4 (500 sheets/ream)',
      description: 'Standard A4 bond paper for printing and copying',
      categoryId: seededCategories['Office Supplies'].id,
      itemType: ItemType.CONSUMABLE,
      barcode: 'CONS-001',
      registeredBy: superAdmin.id,
      consumableProfile: {
        create: { unit: 'reams', quantity: 45, reorderPoint: 10, status: ItemStatus.IN_STOCK },
      },
    },
    include: { consumableProfile: true },
  });

  const ballpenItem = await prisma.item.create({
    data: {
      itemName: 'Ballpen Black (box of 12)',
      description: 'Black ballpoint pens',
      categoryId: seededCategories['Office Supplies'].id,
      itemType: ItemType.CONSUMABLE,
      barcode: 'CONS-002',
      registeredBy: superAdmin.id,
      consumableProfile: {
        create: { unit: 'boxes', quantity: 3, reorderPoint: 5, status: ItemStatus.LOW_STOCK },
      },
    },
    include: { consumableProfile: true },
  });

  const inkItem = await prisma.item.create({
    data: {
      itemName: 'Printer Ink Cartridge (Black)',
      description: 'Compatible ink cartridge for office printers',
      categoryId: seededCategories['Office Supplies'].id,
      itemType: ItemType.CONSUMABLE,
      barcode: 'CONS-003',
      registeredBy: superAdmin.id,
      consumableProfile: {
        create: { unit: 'pcs', quantity: 0, reorderPoint: 3, status: ItemStatus.OUT_OF_STOCK },
      },
    },
    include: { consumableProfile: true },
  });

  const folderItem = await prisma.item.create({
    data: {
      itemName: 'Expandable Folder (long)',
      description: 'Plastic expandable folder for documents',
      categoryId: seededCategories['Office Supplies'].id,
      itemType: ItemType.CONSUMABLE,
      barcode: 'CONS-004',
      registeredBy: superAdmin.id,
      consumableProfile: {
        create: { unit: 'pcs', quantity: 22, reorderPoint: 8, status: ItemStatus.IN_STOCK },
      },
    },
    include: { consumableProfile: true },
  });
  console.log('   ✓ Consumables seeded successfully');

  // ── Seed Equipment Items ──────────────────
  console.log('💻 Seeding equipment items & records...');
  const equipmentData = [
    {
      barcode: 'EQ-ITEM-001',
      itemName: 'MSI Cyborg 15',
      description: 'Gaming-grade laptop for design and dev work',
      categoryId: seededCategories['Laptops'].id,
      assetId: 'EQ-001',
      serialNumber: 'MSI-CYB-2024-001',
      brand: 'MSI',
      model: 'Cyborg 15 A12VE',
      condition: ConditionStatus.GOOD,
      status: EquipmentStatus.AVAILABLE,
      location: 'IT Room',
      acquisitionDate: new Date('2024-01-15'),
      purchasePrice: 52000,
      warrantyEnd: new Date('2027-01-15'),
    },
    {
      barcode: 'EQ-ITEM-002',
      itemName: 'Dell Latitude 5540',
      description: 'Business laptop for office staff',
      categoryId: seededCategories['Laptops'].id,
      assetId: 'EQ-002',
      serialNumber: 'DELL-LAT-2024-002',
      brand: 'Dell',
      model: 'Latitude 5540',
      condition: ConditionStatus.NEW,
      status: EquipmentStatus.AVAILABLE,
      location: 'Storage Room',
      acquisitionDate: new Date('2024-03-10'),
      purchasePrice: 68000,
      warrantyEnd: new Date('2027-03-10'),
    },
    {
      barcode: 'EQ-ITEM-003',
      itemName: 'Logitech MX Keys Keyboard',
      description: 'Wireless mechanical keyboard',
      categoryId: seededCategories['Peripherals'].id,
      assetId: 'EQ-003',
      serialNumber: 'LGT-MXK-2023-003',
      brand: 'Logitech',
      model: 'MX Keys Advanced',
      condition: ConditionStatus.GOOD,
      status: EquipmentStatus.IN_USE,
      location: 'Finance Dept',
      acquisitionDate: new Date('2023-06-20'),
      purchasePrice: 7500,
      warrantyEnd: new Date('2025-06-20'),
    },
    {
      barcode: 'EQ-ITEM-004',
      itemName: 'HP LaserJet Pro M404n',
      description: 'Monochrome laser printer for office use',
      categoryId: seededCategories['Printers'].id,
      assetId: 'EQ-004',
      serialNumber: 'HP-LJP-2022-004',
      brand: 'HP',
      model: 'LaserJet Pro M404n',
      condition: ConditionStatus.FAIR,
      status: EquipmentStatus.UNDER_MAINTENANCE,
      location: 'Admin Office',
      acquisitionDate: new Date('2022-09-01'),
      purchasePrice: 18000,
      warrantyEnd: new Date('2024-09-01'),
    },
    {
      barcode: 'EQ-ITEM-005',
      itemName: 'Cisco SG110-16 Switch',
      description: '16-port gigabit unmanaged switch',
      categoryId: seededCategories['Networking'].id,
      assetId: 'EQ-005',
      serialNumber: 'CSC-SG110-2023-005',
      brand: 'Cisco',
      model: 'SG110-16',
      condition: ConditionStatus.GOOD,
      status: EquipmentStatus.AVAILABLE,
      location: 'Server Room',
      acquisitionDate: new Date('2023-02-14'),
      purchasePrice: 9500,
      warrantyEnd: new Date('2026-02-14'),
    },
    {
      barcode: 'EQ-ITEM-006',
      itemName: 'Lenovo ThinkPad E14',
      description: 'Reliable business laptop',
      categoryId: seededCategories['Laptops'].id,
      assetId: 'EQ-006',
      serialNumber: 'LNV-TPE14-2024-006',
      brand: 'Lenovo',
      model: 'ThinkPad E14 Gen 5',
      condition: ConditionStatus.NEW,
      status: EquipmentStatus.BORROWED,
      location: 'HR Dept',
      acquisitionDate: new Date('2024-05-20'),
      purchasePrice: 55000,
      warrantyEnd: new Date('2027-05-20'),
    },
    {
      barcode: 'EQ-ITEM-007',
      itemName: 'Lenovo ThinkPad E14 (Retired)',
      description: 'Old business laptop',
      categoryId: seededCategories['Laptops'].id,
      assetId: 'EQ-007',
      serialNumber: 'LNV-TPE14-2022-007',
      brand: 'Lenovo',
      model: 'ThinkPad E14 Gen 3',
      condition: ConditionStatus.DAMAGED,
      status: EquipmentStatus.RETIRED,
      location: 'Disposal Yard',
      acquisitionDate: new Date('2022-01-10'),
      purchasePrice: 48000,
      warrantyEnd: new Date('2025-01-10'),
    },
  ];

  const seededEquipment: Record<string, any> = {};
  for (const eq of equipmentData) {
    const item = await prisma.item.create({
      data: {
        itemName: eq.itemName,
        description: eq.description,
        categoryId: eq.categoryId,
        itemType: ItemType.EQUIPMENT,
        barcode: eq.barcode,
        registeredBy: superAdmin.id,
        equipment: {
          create: {
            assetId: eq.assetId,
            serialNumber: eq.serialNumber,
            brand: eq.brand,
            model: eq.model,
            condition: eq.condition,
            status: eq.status,
            location: eq.location,
            acquisitionDate: eq.acquisitionDate,
            purchasePrice: eq.purchasePrice,
            warrantyEnd: eq.warrantyEnd,
          },
        },
      },
      include: { equipment: true },
    });
    seededEquipment[eq.assetId] = item.equipment;
  }
  console.log(`   ✓ ${Object.keys(seededEquipment).length} equipment units seeded`);

  // ── Seed Digital Assets ───────────────────
  console.log('🌐 Seeding digital assets...');
  const digitalAssets = [
    {
      barcode: 'DIG-001',
      itemName: 'Office 365 Business Premium',
      description: 'Productivity suite subscription',
      categoryId: seededCategories['Office Supplies'].id,
      assetType: DigitalAssetType.SOFTWARE,
      url: 'https://microsoft.com',
      vendor: 'Microsoft',
      licenseKey: 'M365-XXXX-YYYY-ZZZZ',
      credentialsRef: 'Creds Vault: O365_Admin',
      seats: 50,
      expiryDate: new Date('2027-12-31'),
      cost: 750,
      billingCycle: BillingCycle.ANNUAL,
      status: DigitalStatus.ACTIVE,
    },
    {
      barcode: 'DIG-002',
      itemName: 'GitHub Copilot Enterprise',
      description: 'AI code completion tool',
      categoryId: seededCategories['Office Supplies'].id,
      assetType: DigitalAssetType.SUBSCRIPTION,
      url: 'https://github.com',
      vendor: 'GitHub',
      licenseKey: 'GH-COPILOT-2026-KEY',
      credentialsRef: 'GitHub Enterprise portal login',
      seats: 20,
      expiryDate: new Date('2026-08-01'),
      cost: 380,
      billingCycle: BillingCycle.MONTHLY,
      status: DigitalStatus.ACTIVE,
    },
    {
      barcode: 'DIG-003',
      itemName: 'jitims.com Domain',
      description: 'Primary corporate system domain name',
      categoryId: seededCategories['Office Supplies'].id,
      assetType: DigitalAssetType.DOMAIN,
      url: 'https://godaddy.com',
      vendor: 'GoDaddy',
      licenseKey: 'DOMAIN-JIT-IMS-2026',
      credentialsRef: 'GoDaddy accounts team credentials',
      seats: null,
      expiryDate: new Date('2026-07-15'),
      cost: 15,
      billingCycle: BillingCycle.ANNUAL,
      status: DigitalStatus.ACTIVE,
    },
  ];

  for (const dig of digitalAssets) {
    await prisma.item.create({
      data: {
        itemName: dig.itemName,
        description: dig.description,
        categoryId: dig.categoryId,
        itemType: ItemType.DIGITAL,
        barcode: dig.barcode,
        registeredBy: superAdmin.id,
        digitalAsset: {
          create: {
            assetType: dig.assetType,
            url: dig.url,
            vendor: dig.vendor,
            licenseKey: dig.licenseKey,
            credentialsRef: dig.credentialsRef,
            seats: dig.seats,
            expiryDate: dig.expiryDate,
            cost: dig.cost,
            billingCycle: dig.billingCycle,
            status: dig.status,
          },
        },
      },
    });
  }
  console.log(`   ✓ ${digitalAssets.length} digital assets seeded`);

  // ── Seed Purchase Orders ──────────────────
  console.log('🛒 Seeding purchase orders...');
  const po1 = await prisma.purchaseOrder.create({
    data: {
      supplierId: supTechPro.id,
      invoiceNumber: 'INV-QA-2024-001',
      status: PurchaseOrderStatus.COMPLETED,
      totalAmount: 16400,
      createdById: superAdmin.id,
      orderDate: new Date('2024-03-01'),
      lineItems: {
        create: [
          { itemId: bondPaperItem.id, quantity: 50, unitCost: 280 },
          { itemId: ballpenItem.id, quantity: 20, unitCost: 120 },
        ],
      },
    },
  });

  const po2 = await prisma.purchaseOrder.create({
    data: {
      supplierId: supOfficeWorld.id,
      invoiceNumber: 'INV-QA-2024-002',
      status: PurchaseOrderStatus.PENDING,
      totalAmount: 10250,
      createdById: manager.id,
      orderDate: new Date('2024-06-15'),
      lineItems: {
        create: [
          { itemId: inkItem.id, quantity: 10, unitCost: 850 },
          { itemId: folderItem.id, quantity: 50, unitCost: 35 },
        ],
      },
    },
  });

  const po3 = await prisma.purchaseOrder.create({
    data: {
      supplierId: supDataLink.id,
      invoiceNumber: 'INV-QA-2024-003',
      status: PurchaseOrderStatus.DRAFT,
      totalAmount: 28000,
      createdById: manager.id,
      orderDate: new Date(),
      lineItems: {
        create: [{ itemId: bondPaperItem.id, quantity: 100, unitCost: 280 }],
      },
    },
  });
  console.log('   ✓ Purchase orders seeded successfully');

  // ── Seed Stock In & Movements ─────────────
  console.log('📈 Seeding stock inflows & movements...');
  if (bondPaperItem.consumableProfile && ballpenItem.consumableProfile) {
    const stockIn1 = await prisma.stockIn.create({
      data: {
        consumableProfileId: bondPaperItem.consumableProfile.id,
        quantityAdded: 50,
        purchaseOrderId: po1.id,
        receivedById: superAdmin.id,
        notes: 'Initial stocking from completed PO',
      },
    });

    await prisma.stockMovement.create({
      data: {
        consumableProfileId: bondPaperItem.consumableProfile.id,
        movementType: 'STOCK_IN',
        quantityChange: 50,
        quantityBefore: 0,
        quantityAfter: 50,
        reason: 'Received shipment from PO INV-QA-2024-001',
        referenceType: 'STOCK_IN',
        referenceId: stockIn1.id,
        performedById: superAdmin.id,
      },
    });

    const stockOut1 = await prisma.stockOut.create({
      data: {
        consumableProfileId: bondPaperItem.consumableProfile.id,
        quantityRemoved: 5,
        purpose: 'Office daily print tasks',
        releasedById: manager.id,
      },
    });

    await prisma.stockMovement.create({
      data: {
        consumableProfileId: bondPaperItem.consumableProfile.id,
        movementType: 'STOCK_OUT',
        quantityChange: -5,
        quantityBefore: 50,
        quantityAfter: 45,
        reason: 'Released for office daily print tasks',
        referenceType: 'STOCK_OUT',
        referenceId: stockOut1.id,
        performedById: manager.id,
      },
    });
  }
  console.log('   ✓ Stock movements seeded successfully');

  // ── Seed Borrow Records ───────────────────
  console.log('🔗 Seeding borrow requests & logs...');
  const eq1 = seededEquipment['EQ-001'].id;
  const eq2 = seededEquipment['EQ-002'].id;
  const eq5 = seededEquipment['EQ-005'].id;
  const eq6 = seededEquipment['EQ-006'].id;

  // PENDING
  await prisma.borrowRecord.create({
    data: {
      equipmentId: eq2,
      borrowedById: staff.id,
      expectedReturn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: BorrowStatus.PENDING,
      notes: 'Need for client presentation next week.',
    },
  });

  // APPROVED
  await prisma.borrowRecord.create({
    data: {
      equipmentId: eq5,
      borrowedById: staff.id,
      approvedById: manager.id,
      expectedReturn: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: BorrowStatus.APPROVED,
      notes: 'Approved for network lab setup.',
    },
  });

  // BORROWED
  await prisma.borrowRecord.create({
    data: {
      equipmentId: eq6,
      borrowedById: staff.id,
      approvedById: superAdmin.id,
      borrowDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      expectedReturn: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      status: BorrowStatus.BORROWED,
      notes: 'Using for remote work this week.',
    },
  });

  // RETURNED
  await prisma.borrowRecord.create({
    data: {
      equipmentId: eq1,
      borrowedById: staff.id,
      approvedById: manager.id,
      borrowDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      expectedReturn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      actualReturn: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      returnCondition: ConditionStatus.GOOD,
      status: BorrowStatus.RETURNED,
      notes: 'Returned in good condition after use for training.',
    },
  });

  // OVERDUE
  await prisma.borrowRecord.create({
    data: {
      equipmentId: eq1,
      borrowedById: manager.id,
      approvedById: superAdmin.id,
      borrowDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      expectedReturn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: BorrowStatus.OVERDUE,
      notes: 'Extended use for branch visit — overdue.',
    },
  });
  console.log('   ✓ Borrow records seeded successfully');

  // ── Seed Maintenance Logs ─────────────────
  console.log('🔧 Seeding maintenance logs...');
  const eq4 = seededEquipment['EQ-004'].id;
  await prisma.maintenanceLog.create({
    data: {
      equipmentId: eq4,
      description: 'Fuser assembly replacement & paper feed roller maintenance',
      status: MaintenanceStatus.IN_PROGRESS,
      scheduledDate: new Date(),
      performedByVendor: 'HP Certified Services',
      notes: 'Parts ordered, technician currently working on the replacement.',
    },
  });

  await prisma.maintenanceLog.create({
    data: {
      equipmentId: eq4,
      description: 'Regular clean-up, roller dusting and test prints',
      status: MaintenanceStatus.COMPLETED,
      scheduledDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      completedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      cost: 1500,
      performedById: manager.id,
      notes: 'Prints resolved successfully. Clean pages.',
      equipmentName: 'HP LaserJet Pro M404n',
      equipmentBrand: 'HP',
      equipmentModel: 'LaserJet Pro M404n',
      equipmentCondition: ConditionStatus.GOOD,
    },
  });
  console.log('   ✓ Maintenance logs seeded successfully');

  // ── Seed Disposals ────────────────────────
  console.log('🗑️ Seeding equipment disposal records...');
  const eq7 = seededEquipment['EQ-007'].id;
  await prisma.disposal.create({
    data: {
      equipmentId: eq7,
      approvedById: superAdmin.id,
      disposalDate: new Date(),
      reason: DisposalReason.DAMAGED_BEYOND_REPAIR,
      method: 'E-Waste Recycler Inc.',
      approvalStatus: DisposalApprovalStatus.COMPLETED,
      notes: 'Spilled water on motherboard, repair exceeds value of laptop.',
    },
  });
  console.log('   ✓ Disposals seeded successfully');

  // ── Seed Inventory Logs ───────────────────
  console.log('📜 Seeding audit logs...');
  await prisma.inventoryLog.create({
    data: {
      entityType: 'ITEM',
      entityId: bondPaperItem.id,
      action: LogAction.CREATED,
      performedBy: superAdmin.id,
      newData: {
        itemName: bondPaperItem.itemName,
        itemType: bondPaperItem.itemType,
        barcode: bondPaperItem.barcode,
      },
    },
  });

  await prisma.inventoryLog.create({
    data: {
      entityType: 'EQUIPMENT',
      entityId: eq2,
      action: LogAction.UPDATED,
      performedBy: manager.id,
      oldData: { condition: 'NEW' },
      newData: { condition: 'GOOD', location: 'Storage Room' },
    },
  });
  console.log('   ✓ Audit logs seeded successfully');

  // ── Seed Alerts ───────────────────────────
  console.log('⚠️ Seeding system notifications/alerts...');
  if (ballpenItem.consumableProfile && inkItem.consumableProfile) {
    await prisma.inventoryAlert.create({
      data: {
        consumableProfileId: ballpenItem.consumableProfile.id,
        alertType: AlertType.LOW_STOCK,
        priority: AlertPriority.WARNING,
        message:
          '"Ballpen Black (box of 12)" is running low (3 boxes remaining, reorder point: 5 boxes).',
      },
    });

    await prisma.inventoryAlert.create({
      data: {
        consumableProfileId: inkItem.consumableProfile.id,
        alertType: AlertType.OUT_OF_STOCK,
        priority: AlertPriority.CRITICAL,
        message:
          '"Printer Ink Cartridge (Black)" is out of stock (current quantity: 0 pcs). Restock required.',
      },
    });
  }
  console.log('   ✓ System alerts seeded successfully');

  console.log('\n✅ Database clearing and seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });