// ============================================
// JIT IMS — QA Feature Seed
// Seeds: suppliers, categories, inventory
//        (consumables + equipment), purchase
//        orders, borrow requests
//
// Run once:  npx tsx scripts/qa-seed-features.ts
// Safe to re-run: skips existing records
// ============================================

import { PrismaClient, ItemType, ItemStatus, EquipmentStatus, ConditionStatus, BorrowStatus, PurchaseOrderStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 QA Feature Seed starting...\n');

  // ── 1. Ensure test users exist ─────────────────────────────────────────────

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const managerRole = await prisma.role.findUnique({ where: { name: 'MANAGER' } });
  const staffRole = await prisma.role.findUnique({ where: { name: 'STAFF' } });

  if (!adminRole || !managerRole || !staffRole) {
    throw new Error('Roles not found — run `npx prisma db seed` first to seed roles.');
  }

  const pw = await bcrypt.hash('password123', 10);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@jitims.com' },
    update: {},
    create: {
      firstName: 'Maria',
      lastName: 'Manager',
      email: 'manager@jitims.com',
      password: pw,
      roleId: managerRole.id,
      isActive: true,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@jitims.com' },
    update: {},
    create: {
      firstName: 'Juan',
      lastName: 'Staff',
      email: 'staff@jitims.com',
      password: pw,
      roleId: staffRole.id,
      isActive: true,
    },
  });

  const admin = await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } } });
  if (!admin) throw new Error('No admin user found — run `npx prisma db seed` first.');

  console.log('✓ Users ready');

  // ── 2. Suppliers ───────────────────────────────────────────────────────────

  const [supplier1, supplier2, supplier3] = await Promise.all([
    prisma.supplier.upsert({
      where: { supplierName: 'TechPro Solutions' } as never,
      update: {},
      create: {
        supplierName: 'TechPro Solutions',
        contactPerson: 'Carlos Reyes',
        email: 'carlos@techpro.ph',
        phone: '09171234567',
        address: '123 Ayala Ave, Makati City',
      },
    }).catch(() => prisma.supplier.findFirst({ where: { supplierName: 'TechPro Solutions' } })),

    prisma.supplier.upsert({
      where: { supplierName: 'OfficeWorld PH' } as never,
      update: {},
      create: {
        supplierName: 'OfficeWorld PH',
        contactPerson: 'Ana Santos',
        email: 'ana@officeworld.ph',
        phone: '09289876543',
        address: '45 Shaw Blvd, Mandaluyong',
      },
    }).catch(() => prisma.supplier.findFirst({ where: { supplierName: 'OfficeWorld PH' } })),

    prisma.supplier.upsert({
      where: { supplierName: 'DataLink Corp' } as never,
      update: {},
      create: {
        supplierName: 'DataLink Corp',
        contactPerson: 'Ben Cruz',
        email: 'ben@datalink.ph',
        phone: '09501112233',
        address: '8 Bonifacio St, BGC Taguig',
      },
    }).catch(() => prisma.supplier.findFirst({ where: { supplierName: 'DataLink Corp' } })),
  ]);

  console.log('✓ Suppliers ready');

  // ── 3. Categories ──────────────────────────────────────────────────────────

  const [catLaptops, catPeripherals, catOfficeSupplies, catNetworking, catPrinters] = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Laptops' },
      update: {},
      create: { name: 'Laptops', type: ItemType.EQUIPMENT, description: 'Laptop computers' },
    }),
    prisma.category.upsert({
      where: { name: 'Peripherals' },
      update: {},
      create: { name: 'Peripherals', type: ItemType.EQUIPMENT, description: 'Keyboards, mice, monitors' },
    }),
    prisma.category.upsert({
      where: { name: 'Office Supplies' },
      update: {},
      create: { name: 'Office Supplies', type: ItemType.CONSUMABLE, description: 'Paper, pens, folders' },
    }),
    prisma.category.upsert({
      where: { name: 'Networking' },
      update: {},
      create: { name: 'Networking', type: ItemType.EQUIPMENT, description: 'Routers, switches, cables' },
    }),
    prisma.category.upsert({
      where: { name: 'Printers' },
      update: {},
      create: { name: 'Printers', type: ItemType.EQUIPMENT, description: 'Inkjet and laser printers' },
    }),
  ]);

  console.log('✓ Categories ready');

  // ── 4. Consumable Items ────────────────────────────────────────────────────

  // Bond Paper — healthy stock
  const bondPaperItem = await prisma.item.upsert({
    where: { barcode: 'CONS-001' },
    update: {},
    create: {
      itemName: 'Bond Paper A4 (500 sheets/ream)',
      description: 'Standard A4 bond paper for printing and copying',
      categoryId: catOfficeSupplies.id,
      itemType: ItemType.CONSUMABLE,
      barcode: 'CONS-001',
      registeredBy: admin.id,
      consumableProfile: {
        create: { unit: 'reams', quantity: 45, reorderPoint: 10, status: ItemStatus.IN_STOCK },
      },
    },
  });

  // Ballpen — low stock (triggers alert)
  const ballpenItem = await prisma.item.upsert({
    where: { barcode: 'CONS-002' },
    update: {},
    create: {
      itemName: 'Ballpen Black (box of 12)',
      description: 'Black ballpoint pens',
      categoryId: catOfficeSupplies.id,
      itemType: ItemType.CONSUMABLE,
      barcode: 'CONS-002',
      registeredBy: admin.id,
      consumableProfile: {
        create: { unit: 'boxes', quantity: 3, reorderPoint: 5, status: ItemStatus.LOW_STOCK },
      },
    },
  });

  // Printer Ink — out of stock (triggers critical alert)
  const inkItem = await prisma.item.upsert({
    where: { barcode: 'CONS-003' },
    update: {},
    create: {
      itemName: 'Printer Ink Cartridge (Black)',
      description: 'Compatible ink cartridge for office printers',
      categoryId: catOfficeSupplies.id,
      itemType: ItemType.CONSUMABLE,
      barcode: 'CONS-003',
      registeredBy: admin.id,
      consumableProfile: {
        create: { unit: 'pcs', quantity: 0, reorderPoint: 3, status: ItemStatus.OUT_OF_STOCK },
      },
    },
  });

  // Folder — healthy
  const folderItem = await prisma.item.upsert({
    where: { barcode: 'CONS-004' },
    update: {},
    create: {
      itemName: 'Expandable Folder (long)',
      description: 'Plastic expandable folder for documents',
      categoryId: catOfficeSupplies.id,
      itemType: ItemType.CONSUMABLE,
      barcode: 'CONS-004',
      registeredBy: admin.id,
      consumableProfile: {
        create: { unit: 'pcs', quantity: 22, reorderPoint: 8, status: ItemStatus.IN_STOCK },
      },
    },
  });

  console.log('✓ Consumable items ready');

  // ── 5. Equipment Items + Equipment Records ─────────────────────────────────

  const equipmentData = [
    {
      barcode: 'EQ-ITEM-001',
      itemName: 'MSI Cyborg 15',
      description: 'Gaming-grade laptop for design and dev work',
      categoryId: catLaptops.id,
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
      categoryId: catLaptops.id,
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
      categoryId: catPeripherals.id,
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
      categoryId: catPrinters.id,
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
      categoryId: catNetworking.id,
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
      categoryId: catLaptops.id,
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
  ];

  const createdEquipment: Record<string, number> = {};

  for (const eq of equipmentData) {
    const existing = await prisma.item.findUnique({ where: { barcode: eq.barcode } });
    if (existing) {
      const eqRecord = await prisma.equipment.findUnique({ where: { itemId: existing.id } });
      if (eqRecord) createdEquipment[eq.assetId] = eqRecord.id;
      continue;
    }

    const item = await prisma.item.create({
      data: {
        itemName: eq.itemName,
        description: eq.description,
        categoryId: eq.categoryId,
        itemType: ItemType.EQUIPMENT,
        barcode: eq.barcode,
        registeredBy: admin.id,
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

    if (item.equipment) {
      createdEquipment[eq.assetId] = item.equipment.id;
    }
  }

  console.log('✓ Equipment items ready');

  // ── 6. Purchase Orders ─────────────────────────────────────────────────────

  const po1 = await prisma.purchaseOrder.findFirst({ where: { invoiceNumber: 'INV-QA-2024-001' } });
  if (!po1 && supplier1) {
    await prisma.purchaseOrder.create({
      data: {
        supplierId: supplier1.id,
        invoiceNumber: 'INV-QA-2024-001',
        status: PurchaseOrderStatus.RECEIVED,
        totalAmount: 124000,
        createdById: admin.id,
        orderDate: new Date('2024-03-01'),
        lineItems: {
          create: [
            { itemId: bondPaperItem.id, quantity: 50, unitCost: 280 },
            { itemId: ballpenItem.id, quantity: 20, unitCost: 120 },
          ],
        },
      },
    });
  }

  const po2 = await prisma.purchaseOrder.findFirst({ where: { invoiceNumber: 'INV-QA-2024-002' } });
  if (!po2 && supplier2) {
    await prisma.purchaseOrder.create({
      data: {
        supplierId: supplier2.id,
        invoiceNumber: 'INV-QA-2024-002',
        status: PurchaseOrderStatus.PENDING,
        totalAmount: 45000,
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
  }

  const po3 = await prisma.purchaseOrder.findFirst({ where: { invoiceNumber: 'INV-QA-2024-003' } });
  if (!po3 && supplier3) {
    await prisma.purchaseOrder.create({
      data: {
        supplierId: supplier3.id,
        invoiceNumber: 'INV-QA-2024-003',
        status: PurchaseOrderStatus.DRAFT,
        totalAmount: 52000,
        createdById: manager.id,
        orderDate: new Date(),
        lineItems: {
          create: [
            { itemId: bondPaperItem.id, quantity: 100, unitCost: 280 },
          ],
        },
      },
    });
  }

  console.log('✓ Purchase orders ready');

  // ── 7. Borrow Requests ─────────────────────────────────────────────────────

  const eq1 = createdEquipment['EQ-001'];
  const eq2 = createdEquipment['EQ-002'];
  const eq5 = createdEquipment['EQ-005'];
  const eq6 = createdEquipment['EQ-006'];

  // PENDING — waiting for approval
  const existPending = await prisma.borrowRecord.findFirst({
    where: { borrowedById: staff.id, status: BorrowStatus.PENDING },
  });
  if (!existPending && eq2) {
    await prisma.borrowRecord.create({
      data: {
        equipmentId: eq2,
        borrowedById: staff.id,
        expectedReturn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: BorrowStatus.PENDING,
        notes: 'Need for client presentation next week.',
      },
    });
  }

  // APPROVED — approved but not yet picked up
  const existApproved = await prisma.borrowRecord.findFirst({
    where: { borrowedById: staff.id, status: BorrowStatus.APPROVED },
  });
  if (!existApproved && eq5) {
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
  }

  // BORROWED — currently out
  const existBorrowed = await prisma.borrowRecord.findFirst({
    where: { borrowedById: staff.id, status: BorrowStatus.BORROWED },
  });
  if (!existBorrowed && eq6) {
    await prisma.borrowRecord.create({
      data: {
        equipmentId: eq6,
        borrowedById: staff.id,
        approvedById: admin.id,
        borrowDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        expectedReturn: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        status: BorrowStatus.BORROWED,
        notes: 'Using for remote work this week.',
      },
    });
  }

  // RETURNED — completed borrow
  const existReturned = await prisma.borrowRecord.findFirst({
    where: { borrowedById: staff.id, status: BorrowStatus.RETURNED },
  });
  if (!existReturned && eq1) {
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
  }

  // OVERDUE — past return date, not returned
  const existOverdue = await prisma.borrowRecord.findFirst({
    where: { borrowedById: manager.id, status: BorrowStatus.OVERDUE },
  });
  if (!existOverdue && eq1) {
    await prisma.borrowRecord.create({
      data: {
        equipmentId: eq1,
        borrowedById: manager.id,
        approvedById: admin.id,
        borrowDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expectedReturn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: BorrowStatus.OVERDUE,
        notes: 'Extended use for branch visit — overdue.',
      },
    });
  }

  console.log('✓ Borrow requests ready');

  // ── 8. Inventory alerts for low/out-of-stock items ─────────────────────────

  const ballpenProfile = await prisma.consumableProfile.findUnique({
    where: { itemId: ballpenItem.id },
  });
  const inkProfile = await prisma.consumableProfile.findUnique({
    where: { itemId: inkItem.id },
  });

  if (ballpenProfile) {
    const existing = await prisma.inventoryAlert.findFirst({
      where: { consumableProfileId: ballpenProfile.id, resolvedAt: null },
    });
    if (!existing) {
      await prisma.inventoryAlert.create({
        data: {
          consumableProfileId: ballpenProfile.id,
          alertType: 'LOW_STOCK',
          priority: 'WARNING',
          message: '"Ballpen Black (box of 12)" is running low (3 boxes remaining, reorder point: 5 boxes).',
        },
      });
    }
  }

  if (inkProfile) {
    const existing = await prisma.inventoryAlert.findFirst({
      where: { consumableProfileId: inkProfile.id, resolvedAt: null },
    });
    if (!existing) {
      await prisma.inventoryAlert.create({
        data: {
          consumableProfileId: inkProfile.id,
          alertType: 'OUT_OF_STOCK',
          priority: 'CRITICAL',
          message: '"Printer Ink Cartridge (Black)" is out of stock (current quantity: 0 pcs). Immediate restocking required.',
        },
      });
    }
  }

  console.log('✓ Inventory alerts seeded');

  console.log('\n✅ QA seed completed!\n');
  console.log('── Test Accounts ──────────────────────────');
  console.log('  Admin:   sam@jitims.com    / admin123');
  console.log('  Manager: manager@jitims.com / password123');
  console.log('  Staff:   staff@jitims.com  / password123');
  console.log('\n── What was seeded ────────────────────────');
  console.log('  Suppliers:       3 (TechPro, OfficeWorld, DataLink)');
  console.log('  Categories:      5 (Laptops, Peripherals, Supplies, Networking, Printers)');
  console.log('  Consumables:     4 (1 healthy, 1 low stock, 1 out of stock, 1 healthy)');
  console.log('  Equipment:       6 (Available, In Use, Borrowed, Under Maintenance)');
  console.log('  Purchase Orders: 3 (Received, Pending, Draft)');
  console.log('  Borrow Requests: 5 (Pending, Approved, Borrowed, Returned, Overdue)');
  console.log('  Alerts:          2 (1 Warning, 1 Critical)');
  console.log('───────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ QA seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });