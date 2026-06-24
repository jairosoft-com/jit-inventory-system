import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ReportType =
  | 'inventory'
  | 'procurement'
  | 'borrowing'
  | 'maintenance'
  | 'disposal'
  | 'employee_equipment'
  | 'low_stock';

export interface ReportMeta {
  type: ReportType;
  generatedAt: string;
  generatedBy: string;
}

// ─────────────────────────────────────────────
// Report Service
// ─────────────────────────────────────────────

export class ReportService {
  // ── 1. Inventory Summary ──────────────────

  static async getInventoryReport() {
    const items = await prisma.item.findMany({
      where: { deletedAt: null },
      include: {
        category: { select: { name: true, type: true } },
        consumableProfile: {
          select: { quantity: true, reorderPoint: true, unit: true, status: true },
        },
        equipment: {
          select: { status: true, condition: true, assetId: true, location: true },
        },
        digitalAsset: {
          select: { status: true, assetType: true, expiryDate: true },
        },
      },
      orderBy: [{ category: { name: 'asc' } }, { itemName: 'asc' }],
    });

    return items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      itemType: item.itemType,
      category: item.category.name,
      categoryType: item.category.type,
      barcode: item.barcode ?? null,
      createdAt: item.createdAt.toISOString(),
      // consumable
      quantity: item.consumableProfile?.quantity ?? null,
      unit: item.consumableProfile?.unit ?? null,
      reorderPoint: item.consumableProfile?.reorderPoint ?? null,
      stockStatus: item.consumableProfile?.status ?? null,
      // equipment
      assetId: item.equipment?.assetId ?? null,
      equipmentStatus: item.equipment?.status ?? null,
      condition: item.equipment?.condition ?? null,
      location: item.equipment?.location ?? null,
      // digital
      digitalStatus: item.digitalAsset?.status ?? null,
      digitalType: item.digitalAsset?.assetType ?? null,
      expiryDate: item.digitalAsset?.expiryDate?.toISOString() ?? null,
    }));
  }

  // ── 2. Procurement Report ─────────────────

  static async getProcurementReport() {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { supplierName: true, contactPerson: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        lineItems: {
          include: {
            item: { select: { itemName: true, itemType: true } },
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    return orders.map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber ?? null,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      orderDate: order.orderDate.toISOString(),
      supplier: order.supplier.supplierName,
      supplierContact: order.supplier.contactPerson ?? null,
      createdBy: `${order.createdBy.firstName} ${order.createdBy.lastName}`,
      itemCount: order.lineItems.length,
      lineItems: order.lineItems.map((li) => ({
        itemName: li.item.itemName,
        itemType: li.item.itemType,
        quantity: li.quantity,
        unitCost: Number(li.unitCost),
        totalCost: Number(li.unitCost) * li.quantity,
      })),
    }));
  }

  // ── 3. Borrowing Report ───────────────────

  static async getBorrowingReport() {
    const records = await prisma.borrowRecord.findMany({
      include: {
        equipment: {
          include: { item: { select: { itemName: true } } },
        },
        borrowedBy: { select: { firstName: true, lastName: true, email: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => ({
      id: record.id,
      equipmentName: record.equipment.item.itemName,
      assetId: record.equipment.assetId,
      borrowedBy: `${record.borrowedBy.firstName} ${record.borrowedBy.lastName}`,
      borrowedByEmail: record.borrowedBy.email,
      approvedBy: record.approvedBy
        ? `${record.approvedBy.firstName} ${record.approvedBy.lastName}`
        : null,
      status: record.status,
      borrowDate: record.borrowDate?.toISOString() ?? null,
      expectedReturn: record.expectedReturn.toISOString(),
      actualReturn: record.actualReturn?.toISOString() ?? null,
      returnCondition: record.returnCondition ?? null,
      notes: record.notes ?? null,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  // ── 4. Maintenance Report ─────────────────

  static async getMaintenanceReport() {
    const logs = await prisma.maintenanceLog.findMany({
      include: {
        equipment: {
          include: { item: { select: { itemName: true } } },
        },
        performedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id,
      equipmentName: log.equipment.item.itemName,
      assetId: log.equipment.assetId,
      description: log.description,
      status: log.status,
      scheduledDate: log.scheduledDate?.toISOString() ?? null,
      completedDate: log.completedDate?.toISOString() ?? null,
      cost: log.cost !== null ? Number(log.cost) : null,
      performedBy: log.performedBy
        ? `${log.performedBy.firstName} ${log.performedBy.lastName}`
        : null,
      performedByVendor: log.performedByVendor ?? null,
      notes: log.notes ?? null,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  // ── 5. Disposal Report ────────────────────

  static async getDisposalReport() {
    const disposals = await prisma.disposal.findMany({
      include: {
        equipment: {
          include: { item: { select: { itemName: true } } },
        },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { disposalDate: 'desc' },
    });

    return disposals.map((disposal) => ({
      id: disposal.id,
      equipmentName: disposal.equipment.item.itemName,
      assetId: disposal.equipment.assetId,
      reason: disposal.reason,
      method: disposal.method,
      disposalDate: disposal.disposalDate.toISOString(),
      approvedBy: `${disposal.approvedBy.firstName} ${disposal.approvedBy.lastName}`,
      notes: disposal.notes ?? null,
    }));
  }

  // ── 6. Employee Equipment Report ──────────

  static async getEmployeeEquipmentReport() {
    const equipment = await prisma.equipment.findMany({
      where: {
        deletedAt: null,
        assignedTo: { not: null },
      },
      include: {
        item: { select: { itemName: true, category: { select: { name: true } } } },
        assignedToUser: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [
        { assignedToUser: { lastName: 'asc' } },
        { item: { itemName: 'asc' } },
      ],
    });

    return equipment.map((eq) => ({
      id: eq.id,
      itemName: eq.item.itemName,
      category: eq.item.category.name,
      assetId: eq.assetId,
      serialNumber: eq.serialNumber ?? null,
      brand: eq.brand ?? null,
      model: eq.model ?? null,
      condition: eq.condition,
      status: eq.status,
      location: eq.location ?? null,
      acquisitionDate: eq.acquisitionDate?.toISOString() ?? null,
      purchasePrice: eq.purchasePrice !== null ? Number(eq.purchasePrice) : null,
      warrantyEnd: eq.warrantyEnd?.toISOString() ?? null,
      assignedTo: eq.assignedToUser
        ? `${eq.assignedToUser.firstName} ${eq.assignedToUser.lastName}`
        : null,
      assignedToEmail: eq.assignedToUser?.email ?? null,
    }));
  }

  // ── 7. Low Stock Report ───────────────────

  static async getLowStockReport() {
    const profiles = await prisma.consumableProfile.findMany({
      where: {
        item: { deletedAt: null },
        status: { not: 'ARCHIVED' },
      },
      include: {
        item: {
          select: {
            itemName: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: [{ quantity: 'asc' }, { reorderPoint: 'desc' }],
    });

    const lowStock = profiles.filter((p) => p.quantity <= p.reorderPoint);

    return lowStock.map((profile) => ({
      id: profile.id,
      itemName: profile.item.itemName,
      category: profile.item.category.name,
      currentQuantity: profile.quantity,
      reorderPoint: profile.reorderPoint,
      unit: profile.unit,
      deficit: Math.max(profile.reorderPoint - profile.quantity + 1, 0),
      stockStatus: profile.quantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
    }));
  }

  // ── Dispatcher ────────────────────────────

  static async generateReport(type: ReportType) {
    switch (type) {
      case 'inventory':
        return ReportService.getInventoryReport();
      case 'procurement':
        return ReportService.getProcurementReport();
      case 'borrowing':
        return ReportService.getBorrowingReport();
      case 'maintenance':
        return ReportService.getMaintenanceReport();
      case 'disposal':
        return ReportService.getDisposalReport();
      case 'employee_equipment':
        return ReportService.getEmployeeEquipmentReport();
      case 'low_stock':
        return ReportService.getLowStockReport();
      default:
        throw new Error(`Unknown report type: ${String(type)}`);
    }
  }
}