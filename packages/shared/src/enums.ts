// ============================================
// JIT IMS — Shared Enums
// Mirror of Prisma enum definitions for use in
// frontend and backend without Prisma dependency
// ============================================

export enum ItemStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  ARCHIVED = 'ARCHIVED',
}

export enum EquipmentStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
  BORROWED = 'BORROWED',
  RETIRED = 'RETIRED',
}

export enum BorrowStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BORROWED = 'BORROWED',
  RETURNED = 'RETURNED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum ConditionStatus {
  NEW = 'NEW',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
  DAMAGED = 'DAMAGED',
}

export enum AssignmentType {
  PHYSICAL = 'PHYSICAL',
  DIGITAL = 'DIGITAL',
}

export enum DisposalReason {
  DAMAGED_BEYOND_REPAIR = 'DAMAGED_BEYOND_REPAIR',
  OUTDATED = 'OUTDATED',
  LOST = 'LOST',
}

export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export enum LogAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BORROWED = 'BORROWED',
  RETURNED = 'RETURNED',
  DISPOSED = 'DISPOSED',
}

export enum ItemType {
  EQUIPMENT = 'EQUIPMENT',
  CONSUMABLE = 'CONSUMABLE',
}
