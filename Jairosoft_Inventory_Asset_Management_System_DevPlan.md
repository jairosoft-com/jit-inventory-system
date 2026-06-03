# Jairosoft Inventory & Asset Management System

**Technical Specification & Implementation Blueprint**

| Field            | Value                            |
| ---------------- | -------------------------------- |
| Document version | 4.2 (decisions resolved)         |
| Status           | Draft — for team review          |
| Audience         | Engineering, Product, Operations |
| Owner            | _TBD — assign before sign-off_   |
| Last updated     | _TBD on publish_                 |

> **About this revision.** This document is a cleanup of the v4.0 spec. Source-citation artifacts have been removed, the schema reference tables in Section 7 have been reconstructed (they were collapsed into a single line in the source), the architecture diagram has been redrawn, and unclear language has been rewritten. Substantive open questions are collected in Section 11 rather than buried in prose — please review that section before the kickoff meeting.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Glossary](#2-glossary)
3. [Technical Stack & Architecture](#3-technical-stack--architecture)
4. [Business Workflows](#4-business-workflows)
5. [Role-Based Access Control & Security](#5-role-based-access-control--security)
6. [Prisma Schema (Source of Truth)](#6-prisma-schema-source-of-truth)
7. [Database Table Reference](#7-database-table-reference)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Delivery Roadmap](#9-delivery-roadmap)
10. [Out of Scope (v1)](#10-out-of-scope-v1)
11. [Decisions & Local Development Setup](#11-decisions--local-development-setup)
12. [Change Log](#12-change-log)

---

## 1. Executive Summary

The Jairosoft Inventory & Asset Management System is an internal web application for tracking the company's physical equipment, consumable supplies, and digital assets (software licenses, subscriptions, domains). It replaces ad-hoc spreadsheet tracking with a single system of record.

The system runs on a dedicated backend (Express + Prisma + PostgreSQL) rather than a managed BaaS platform, so we control schema migrations, query performance, and audit retention directly.

### Goals

- **Real-time inventory visibility.** Stock levels, low-stock alerts, and reorder triggers update as transactions happen.
- **Equipment accountability.** A full lifecycle for borrow → return → maintenance → disposal, with condition captured at each handoff.
- **Role-based access.** All write actions are gated by database-backed permissions, evaluated server-side.
- **Audit trail.** Every mutation on tracked tables produces an immutable log entry recording who, what, when, before, and after.

### Non-goals (v1)

See [Section 10](#10-out-of-scope-v1) for the full out-of-scope list.

---

## 2. Glossary

| Term              | Meaning                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JIT**           | Just-In-Time. The internal codename for this system. Not the inventory methodology in the academic sense.                                               |
| **Asset**         | Any tracked item: equipment, consumable, or digital asset.                                                                                              |
| **Equipment**     | A physical, individually trackable hardware unit (laptop, monitor, camera). One row in `equipment` per physical unit, with a system-generated Asset ID. |
| **Consumable**    | A bulk item tracked by quantity, not by individual unit (cables, paper, batteries).                                                                     |
| **Digital Asset** | A software license, subscription seat, domain, or API key.                                                                                              |
| **Asset ID**      | Human-readable system-generated tag for a single equipment unit (e.g., `JIT-EQ-0042`). Distinct from the manufacturer serial number.                    |
| **PO**            | Purchase Order.                                                                                                                                         |
| **RBAC**          | Role-Based Access Control.                                                                                                                              |
| **AT / RT**       | Access Token / Refresh Token (see Section 5.2).                                                                                                         |
| **Soft delete**   | Marking a row with `deleted_at` instead of removing it, preserving history.                                                                             |

---

## 3. Technical Stack & Architecture

```
┌────────────────────────────────────────────┐
│                Client Layer                │
│  React 19 + Vite (SPA)                     │
│  Zustand (in-memory auth + UI state)       │
│  Tailwind CSS                              │
│  Axios (with token-refresh interceptor)    │
└────────────────────┬───────────────────────┘
                     │ HTTPS / REST
┌────────────────────┴───────────────────────┐
│              Backend API                   │
│  Express (REST controllers)                │
│  Prisma ORM                                │
│  bcrypt (password hashing)                 │
│  jsonwebtoken (AT / RT signing)            │
└────────────────────┬───────────────────────┘
                     │ SQL
┌────────────────────┴───────────────────────┐
│              Data Layer                    │
│  PostgreSQL (relational store)             │
│  S3-compatible object store (files/images) │
└────────────────────────────────────────────┘
```

### 3.1 Backend API (Express + Prisma)

- **Framework:** Express with TypeScript.
- **ORM:** Prisma Client targeting a dedicated PostgreSQL instance. The schema in Section 6 is the source of truth; migrations are generated from it.
- **Database:** PostgreSQL with relational indexes as declared in the schema (`@@index` directives).
- **Crypto:** `bcrypt` for password hashing, `jsonwebtoken` for AT/RT signing. Refresh tokens are stored as SHA-256 hashes (not the raw token).

### 3.2 Frontend (React + Vite)

- **Runtime:** React 19, bundled with Vite, deployed as a single-page application.
- **State:** Zustand for client state, including the in-memory access token. Tokens are **not** written to `localStorage` or `sessionStorage`.
- **Styling:** Tailwind CSS, responsive layouts across desktop and tablet.
- **HTTP:** Axios with a response interceptor that catches 401s and silently refreshes the AT using the RT cookie.

### 3.3 File & Image Storage

- **Object store:** MinIO (S3-compatible, runs via Docker Compose — see [Section 11](#11-decisions--local-development-setup)).
- **Upload flow:** The client posts multipart uploads to the API. The API validates the file, streams it to MinIO, and records the resulting URL in the relevant row (`items.image_url`, `equipment.warranty_doc_url`, `purchase_orders.receipt_url`).

---

## 4. Business Workflows

### 4.1 Procurement

Records every purchase from validated suppliers.

1. Create or select a supplier profile.
2. Draft a Purchase Order (PO) with one or more line items, each with quantity and unit cost.
3. Approve the PO (status moves `DRAFT` → `PENDING` → `APPROVED`).
4. Receive goods: create `stock_in` rows linked to the PO, attach the supplier invoice, and the PO status moves to `RECEIVED`.

**Rules**

- Only Manager or Admin can create or approve POs.
- `purchase_orders.invoice_number` is unique — the same invoice cannot be entered twice.
- Stock cannot be incremented without a PO reference, except for opening-balance imports during initial seeding.

### 4.2 Asset Registration

Brings new inventory into the catalog. There are three registration paths depending on item type:

- **Consumables.** A single `items` row tracks the bulk quantity (e.g., 500 ream of paper). Quantity changes flow through `stock_in` and `stock_out`.
- **Equipment.** Creates one `items` row for the catalog entry and **one `equipment` row per physical unit**, each with a system-generated `asset_id`, brand, model, and (where available) manufacturer serial number. For equipment, `items.quantity` is the count of currently-available `equipment` rows — kept in sync by application code in a transaction (see [Section 11, Decision 3](#decision-3--equipment-quantity-sync-application-code-in-a-transaction)).
- **Digital assets.** Creates one `items` row and one `digital_assets` row with vendor, license key, seat count, expiry, billing cycle, and cost.

### 4.3 Usage & Stock Monitoring

- **Consumable outflow.** Staff or managers create `stock_out` rows with a stated purpose; `items.quantity` decrements.
- **Low-stock detection.** When `items.quantity <= items.reorder_point`, the row's `status` flips to `LOW_STOCK` (or `OUT_OF_STOCK` at zero). The detection runs on every write to `items` and powers the operations dashboard.

### 4.4 Equipment Borrow & Return

Governs temporary loans of physical hardware to employees.

1. **Request.** A staff member submits a borrow request specifying the target equipment unit and expected return date. A `borrow_records` row is created with status `PENDING`.
2. **Hold.** While `PENDING`, the equipment is hidden from other users' availability views.
3. **Review.** A Manager either approves (status → `APPROVED`, then `BORROWED` once handed over) or rejects (status → `REJECTED` with a required reason).
4. **Handover.** When the asset leaves the storage location, `equipment.status` moves to `BORROWED` and `borrow_date` is set.
5. **Return.** A Manager physically inspects the returning unit, sets `return_condition`, and marks the record `RETURNED`. The equipment status returns to `AVAILABLE` (or `UNDER_MAINTENANCE` / `DAMAGED` if the inspection finds an issue).
6. **Overdue handling.** If `actual_return IS NULL AND expected_return < now()`, the record moves to `OVERDUE`. Employees with one or more `OVERDUE` records cannot file new borrow requests.

### 4.5 Maintenance

Tracks repair and inspection events on equipment.

- A Manager creates a `maintenance_logs` entry with a description, a scheduled date, and either an internal technician (`performed_by_id`) or an external vendor (`performed_by_vendor`).
- Equipment status moves to `UNDER_MAINTENANCE` while the log is `SCHEDULED` or `IN_PROGRESS`.
- On completion, the cost and completion date are recorded, and the equipment status returns to `AVAILABLE` (or `DAMAGED` / `RETIRED` based on the outcome).

### 4.6 Disposal & Retirement

Ends an asset's lifecycle.

1. A Manager submits a disposal request (`disposals` row, status implicit via `equipment.status`).
2. An Admin approves it.
3. The equipment status is set to `RETIRED`.
4. The disposal reason is recorded (`DAMAGED_BEYOND_REPAIR`, `OUTDATED`, `LOST`, `STOLEN`, or `DONATED`) along with the disposal method (e.g., e-waste recycler, donation recipient).
5. If a replacement is needed, the Manager raises a new PO referencing the retired asset in the PO notes.

### 4.7 Digital Asset Lifecycle

- **Creation.** Admin or Manager records a new digital asset with vendor, type, seats, expiry, billing cycle.
- **Renewal.** When `expiry_date` is approaching (see notification rules in Section 8), the system flags it on the dashboard. Renewal updates the existing row's `expiry_date` and increments `renewal_count`; a `LogAction.RENEWED` entry is written to `inventory_logs` (see [Section 11, Decision 9](#decision-9--digital-asset-renewal-model-update-existing-row)).
- **Expiry.** A scheduled job sets `status` to `EXPIRED` for any active digital asset past its `expiry_date`.
- **Cancellation.** A Manager can move an active digital asset to `CANCELLED` with notes.

---

## 5. Role-Based Access Control & Security

### 5.1 Roles

| Role        | Scope                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**   | Full data access and configuration. Manages users, roles, and permissions. Approves disposals. Can override or correct historical records.           |
| **Manager** | Day-to-day operations. Creates categories, suppliers, items, equipment, and POs. Approves borrow requests. Records maintenance, stock-in, stock-out. |
| **Staff**   | Browses the catalog, submits and cancels their own borrow requests, views their own transaction history.                                             |

Roles and permissions live in `roles`, `permissions`, and `role_permissions`. Permissions follow a `resource:action` naming convention (e.g., `purchase_order:approve`, `borrow:request`). The default permission set is created by a seed script at deploy time.

### 5.2 Dual-Token Authentication

To mitigate XSS token theft and CSRF, the API uses two tokens:

**Access Token (AT)**

- JWT, 15-minute lifespan.
- Held only in JavaScript memory (Zustand store).
- Sent as `Authorization: Bearer <AT>` on every API request.
- Never written to `localStorage` or `sessionStorage`.

**Refresh Token (RT)**

- JWT, 7-day lifespan.
- Delivered in an `httpOnly; Secure; SameSite=Strict` cookie scoped to the API origin.
- Invisible to JavaScript, so it cannot be exfiltrated by an XSS payload.
- Stored server-side as a SHA-256 hash in `refresh_tokens`, allowing per-session revocation.

On a 401 response, the Axios interceptor calls `/auth/refresh`, which mints a new AT (and rotates the RT). If the refresh fails, the user is bounced to the login screen.

### 5.3 Additional Security Notes

- Passwords hashed with `bcrypt` (cost factor 12).
- All routes are gated by a permission-check middleware that reads `role_permissions` for the requesting user.
- Sensitive fields (license keys) are encrypted using pgcrypto column-level encryption — see [Section 11, Decision 2](#decision-2--license-key-encryption-pgcrypto-column-level).

---

## 6. Prisma Schema (Source of Truth)

This schema is authoritative. Copy it directly into `prisma/schema.prisma`. Migration files are generated from this schema, not hand-written.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// Enums
// ==========================================

enum ItemType {
  EQUIPMENT
  CONSUMABLE
  DIGITAL
}

enum ItemStatus {
  IN_STOCK
  LOW_STOCK
  OUT_OF_STOCK
  ARCHIVED
}

enum EquipmentStatus {
  AVAILABLE
  IN_USE
  UNDER_MAINTENANCE
  DAMAGED
  LOST
  BORROWED
  RETIRED
}

enum DigitalStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  SUSPENDED
}

enum DigitalAssetType {
  SOFTWARE
  SUBSCRIPTION
  DOMAIN
  LICENSE
  API_KEY
}

enum BillingCycle {
  MONTHLY
  QUARTERLY
  ANNUAL
  ONE_TIME
}

enum BorrowStatus {
  PENDING
  APPROVED
  REJECTED
  BORROWED
  RETURNED
  OVERDUE
  CANCELLED
}

enum ConditionStatus {
  NEW
  GOOD
  FAIR
  POOR
  DAMAGED
}

enum DisposalReason {
  DAMAGED_BEYOND_REPAIR
  OUTDATED
  LOST
  STOLEN
  DONATED
}

enum MaintenanceStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum PurchaseOrderStatus {
  DRAFT
  PENDING
  APPROVED
  RECEIVED
  CANCELLED
}

enum LogAction {
  CREATED
  UPDATED
  DELETED
  APPROVED
  REJECTED
  BORROWED
  RETURNED
  DISPOSED
  TRANSFERRED
  MAINTENANCE_STARTED
  MAINTENANCE_COMPLETED
  RENEWED
}

// ==========================================
// Models
// ==========================================

model Role {
  id              Int              @id @default(autoincrement())
  name            String           @unique @db.VarChar(50)
  description     String?          @db.Text
  isSystem        Boolean          @default(false) @map("is_system")
  createdAt       DateTime         @default(now()) @map("created_at")

  users           User[]
  rolePermissions RolePermission[]

  @@map("roles")
}

model Permission {
  id              Int              @id @default(autoincrement())
  name            String           @unique @db.VarChar(100)
  resource        String           @db.VarChar(50)
  action          String           @db.VarChar(50)
  description     String?          @db.Text

  rolePermissions RolePermission[]

  @@map("permissions")
}

model RolePermission {
  id           Int        @id @default(autoincrement())
  roleId       Int        @map("role_id")
  permissionId Int        @map("permission_id")

  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
  @@map("role_permissions")
}

model User {
  id                 Int              @id @default(autoincrement())
  firstName          String           @map("first_name") @db.VarChar(100)
  lastName           String           @map("last_name") @db.VarChar(100)
  email              String           @unique @db.VarChar(255)
  password           String           @db.VarChar(255)
  roleId             Int              @map("role_id")
  isActive           Boolean          @default(true) @map("is_active")
  createdAt          DateTime         @default(now()) @map("created_at")
  deletedAt          DateTime?        @map("deleted_at")

  role               Role             @relation(fields: [roleId], references: [id])
  refreshTokens      RefreshToken[]
  itemsRegistered    Item[]           @relation("RegisteredBy")
  equipmentAssigned  Equipment[]      @relation("AssignedTo")
  purchaseOrders     PurchaseOrder[]  @relation("CreatedByUser")
  stockInReceived    StockIn[]        @relation("ReceivedByUser")
  stockOutReleased   StockOut[]       @relation("ReleasedByUser")
  borrowRequests     BorrowRecord[]   @relation("BorrowedByUser")
  borrowApprovals    BorrowRecord[]   @relation("ApprovedByUser")
  maintenanceJobs    MaintenanceLog[] @relation("PerformedByUser")
  disposalsApproved  Disposal[]       @relation("DisposalApprovedBy")
  activityLogs       InventoryLog[]

  @@index([isActive])
  @@index([roleId])
  @@map("users")
}

model RefreshToken {
  id         Int       @id @default(autoincrement())
  userId     Int       @map("user_id")
  tokenHash  String    @unique @map("token_hash") @db.VarChar(255)
  expiresAt  DateTime  @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

model Category {
  id          Int       @id @default(autoincrement())
  name        String    @unique @db.VarChar(100)
  type        ItemType
  description String?   @db.Text
  deletedAt   DateTime? @map("deleted_at")

  items       Item[]

  @@index([type])
  @@map("categories")
}

model Item {
  id              Int                 @id @default(autoincrement())
  itemName        String              @map("item_name") @db.VarChar(255)
  description     String?             @db.Text
  categoryId      Int                 @map("category_id")
  unit            String              @db.VarChar(50)
  quantity        Int                 @default(0)
  reorderPoint    Int                 @default(0) @map("reorder_point")
  status          ItemStatus          @default(IN_STOCK)
  barcode         String?             @unique @db.VarChar(255)
  imageUrl        String?             @map("image_url") @db.VarChar(500)
  registeredBy    Int?                @map("registered_by")
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")
  deletedAt       DateTime?           @map("deleted_at")

  category         Category            @relation(fields: [categoryId], references: [id])
  registeredByUser User?               @relation("RegisteredBy", fields: [registeredBy], references: [id])
  equipment        Equipment?
  digitalAsset     DigitalAsset?
  poItems          PurchaseOrderItem[]
  stockIns         StockIn[]
  stockOuts        StockOut[]

  @@index([categoryId])
  @@index([status])
  @@map("items")
}

model Equipment {
  id               Int              @id @default(autoincrement())
  itemId           Int              @unique @map("item_id")
  assetId          String           @unique @map("asset_id") @db.VarChar(100)
  serialNumber     String?          @unique @map("serial_number") @db.VarChar(100)
  brand            String?          @db.VarChar(255)
  model            String?          @db.VarChar(255)
  condition        ConditionStatus  @default(NEW)
  status           EquipmentStatus  @default(AVAILABLE)
  location         String?          @db.VarChar(255)
  assignedTo       Int?             @map("assigned_to")
  acquisitionDate  DateTime?        @map("acquisition_date") @db.Date
  purchasePrice    Decimal?         @map("purchase_price") @db.Decimal(10, 2)
  warrantyStart    DateTime?        @map("warranty_start") @db.Date
  warrantyEnd      DateTime?        @map("warranty_end") @db.Date
  warrantyProvider String?          @map("warranty_provider") @db.VarChar(255)
  warrantyDocUrl   String?          @map("warranty_doc_url") @db.VarChar(500)
  createdAt        DateTime         @default(now()) @map("created_at")
  updatedAt        DateTime         @updatedAt @map("updated_at")

  item             Item             @relation(fields: [itemId], references: [id])
  assignedToUser   User?            @relation("AssignedTo", fields: [assignedTo], references: [id])
  borrowRecords    BorrowRecord[]
  maintenanceLogs  MaintenanceLog[]
  disposal         Disposal?

  @@index([status])
  @@index([assignedTo])
  @@index([warrantyEnd])
  @@map("equipment")
}

model DigitalAsset {
  id             Int              @id @default(autoincrement())
  itemId         Int              @unique @map("item_id")
  assetType      DigitalAssetType @map("asset_type")
  url            String?          @db.VarChar(500)
  vendor         String?          @db.VarChar(255)
  licenseKey     String?          @map("license_key") @db.Text
  credentialsRef String?          @map("credentials_ref") @db.VarChar(255)
  seats          Int?
  expiryDate     DateTime?        @map("expiry_date") @db.Date
  cost           Decimal?         @db.Decimal(10, 2)
  billingCycle   BillingCycle?    @map("billing_cycle")
  status         DigitalStatus    @default(ACTIVE)
  notes          String?          @db.Text
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")

  item           Item             @relation(fields: [itemId], references: [id])

  @@index([status])
  @@index([expiryDate])
  @@index([assetType])
  @@map("digital_assets")
}

model Supplier {
  id            Int             @id @default(autoincrement())
  supplierName  String          @map("supplier_name") @db.VarChar(255)
  contactPerson String?         @map("contact_person") @db.VarChar(255)
  email         String?         @db.VarChar(255)
  phone         String?         @db.VarChar(50)
  address       String?         @db.Text
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")
  deletedAt     DateTime?       @map("deleted_at")

  purchaseOrders PurchaseOrder[]

  @@map("suppliers")
}

model PurchaseOrder {
  id            Int                 @id @default(autoincrement())
  supplierId    Int                 @map("supplier_id")
  invoiceNumber String?             @unique @map("invoice_number") @db.VarChar(100)
  status        PurchaseOrderStatus @default(DRAFT)
  totalAmount   Decimal             @map("total_amount") @db.Decimal(10, 2)
  receiptUrl    String?             @map("receipt_url") @db.VarChar(500)
  createdById   Int                 @map("created_by_id")
  orderDate     DateTime            @default(now()) @map("order_date")
  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")

  supplier      Supplier            @relation(fields: [supplierId], references: [id])
  createdBy     User                @relation("CreatedByUser", fields: [createdById], references: [id])
  lineItems     PurchaseOrderItem[]
  stockIns      StockIn[]

  @@index([status])
  @@index([supplierId])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id              Int           @id @default(autoincrement())
  purchaseOrderId Int           @map("purchase_order_id")
  itemId          Int           @map("item_id")
  quantity        Int
  unitCost        Decimal       @map("unit_cost") @db.Decimal(10, 2)

  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  item            Item          @relation(fields: [itemId], references: [id])

  @@unique([purchaseOrderId, itemId])
  @@map("purchase_order_items")
}

model StockIn {
  id              Int            @id @default(autoincrement())
  itemId          Int            @map("item_id")
  quantityAdded   Int            @map("quantity_added")
  purchaseOrderId Int?           @map("purchase_order_id")
  receivedById    Int            @map("received_by_id")
  notes           String?        @db.Text
  createdAt       DateTime       @default(now()) @map("created_at")

  item            Item           @relation(fields: [itemId], references: [id])
  purchaseOrder   PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id])
  receivedBy      User           @relation("ReceivedByUser", fields: [receivedById], references: [id])

  @@index([itemId])
  @@map("stock_in")
}

model StockOut {
  id              Int      @id @default(autoincrement())
  itemId          Int      @map("item_id")
  quantityRemoved Int      @map("quantity_removed")
  purpose         String   @db.Text
  releasedById    Int      @map("released_by_id")
  notes           String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  item            Item     @relation(fields: [itemId], references: [id])
  releasedBy      User     @relation("ReleasedByUser", fields: [releasedById], references: [id])

  @@index([itemId])
  @@map("stock_out")
}

model BorrowRecord {
  id              Int              @id @default(autoincrement())
  equipmentId     Int              @map("equipment_id")
  borrowedById    Int              @map("borrowed_by_id")
  approvedById    Int?             @map("approved_by_id")
  borrowDate      DateTime?        @map("borrow_date")
  expectedReturn  DateTime         @map("expected_return") @db.Date
  actualReturn    DateTime?        @map("actual_return")
  returnCondition ConditionStatus? @map("return_condition")
  status          BorrowStatus     @default(PENDING)
  notes           String?          @db.Text
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  equipment       Equipment        @relation(fields: [equipmentId], references: [id])
  borrowedBy      User             @relation("BorrowedByUser", fields: [borrowedById], references: [id])
  approvedBy      User?            @relation("ApprovedByUser", fields: [approvedById], references: [id])

  @@index([equipmentId])
  @@index([expectedReturn])
  @@index([status])
  @@map("borrow_records")
}

model MaintenanceLog {
  id                 Int               @id @default(autoincrement())
  equipmentId        Int               @map("equipment_id")
  description        String            @db.Text
  status             MaintenanceStatus @default(SCHEDULED)
  scheduledDate      DateTime?         @map("scheduled_date") @db.Date
  completedDate      DateTime?         @map("completed_date") @db.Date
  cost               Decimal?          @db.Decimal(10, 2)
  performedById      Int?              @map("performed_by_id")
  performedByVendor  String?           @map("performed_by_vendor") @db.VarChar(255)
  notes              String?           @db.Text
  createdAt          DateTime          @default(now()) @map("created_at")
  updatedAt          DateTime          @updatedAt @map("updated_at")

  equipment          Equipment         @relation(fields: [equipmentId], references: [id])
  performedBy        User?             @relation("PerformedByUser", fields: [performedById], references: [id])

  @@index([equipmentId])
  @@index([status])
  @@map("maintenance_logs")
}

model Disposal {
  id               Int            @id @default(autoincrement())
  equipmentId      Int            @unique @map("equipment_id")
  approvedById     Int            @map("approved_by_id")
  disposalDate     DateTime       @default(now()) @map("disposal_date")
  reason           DisposalReason
  method           String         @db.VarChar(100)
  notes            String?        @db.Text
  createdAt        DateTime       @default(now()) @map("created_at")

  equipment        Equipment      @relation(fields: [equipmentId], references: [id])
  approvedBy       User           @relation("DisposalApprovedBy", fields: [approvedById], references: [id])

  @@map("disposals")
}

model InventoryLog {
  id          Int       @id @default(autoincrement())
  entityType  String    @map("entity_type") @db.VarChar(50)
  entityId    Int       @map("entity_id")
  action      LogAction
  oldData     Json?     @map("old_data")
  newData     Json?     @map("new_data")
  performedBy Int       @map("performed_by")
  performedAt DateTime  @default(now()) @map("performed_at")

  user        User      @relation(fields: [performedBy], references: [id])

  @@index([entityType, entityId])
  @@index([performedAt])
  @@index([performedBy])
  @@map("inventory_logs")
}
```

---

## 7. Database Table Reference

The tables below describe each entity. They mirror the Prisma schema above and are provided so reviewers can scan the model without parsing Prisma syntax.

### 7.1 `roles`

Defines system-wide role identities. Seeded at deploy; system roles cannot be deleted.

| Field       | Type        | Constraints               | Notes                               |
| ----------- | ----------- | ------------------------- | ----------------------------------- |
| id          | INT         | PK, auto-increment        |                                     |
| name        | VARCHAR(50) | UNIQUE, NOT NULL          | Seeded: `ADMIN`, `MANAGER`, `STAFF` |
| description | TEXT        | nullable                  |                                     |
| is_system   | BOOLEAN     | NOT NULL, default `false` | Blocks deletion of seeded roles     |
| created_at  | TIMESTAMP   | NOT NULL, default `now()` |                                     |

### 7.2 `permissions`

String-keyed feature flags evaluated by the route middleware.

| Field       | Type         | Constraints        | Notes                                       |
| ----------- | ------------ | ------------------ | ------------------------------------------- |
| id          | INT          | PK, auto-increment |                                             |
| name        | VARCHAR(100) | UNIQUE, NOT NULL   | e.g., `inventory:create`                    |
| resource    | VARCHAR(50)  | NOT NULL           | e.g., `inventory`, `orders`                 |
| action      | VARCHAR(50)  | NOT NULL           | e.g., `create`, `read`, `update`, `approve` |
| description | TEXT         | nullable           |                                             |

### 7.3 `role_permissions`

Join table mapping roles to permissions.

| Field         | Type | Constraints                              | Notes                     |
| ------------- | ---- | ---------------------------------------- | ------------------------- |
| id            | INT  | PK, auto-increment                       |                           |
| role_id       | INT  | FK → `roles.id`, ON DELETE CASCADE       |                           |
| permission_id | INT  | FK → `permissions.id`, ON DELETE CASCADE |                           |
| (composite)   |      | UNIQUE(role_id, permission_id)           | Prevents duplicate grants |

### 7.4 `users`

Authentication and identity. Soft-deleted via `deleted_at`.

| Field      | Type         | Constraints               | Notes                              |
| ---------- | ------------ | ------------------------- | ---------------------------------- |
| id         | INT          | PK, auto-increment        |                                    |
| first_name | VARCHAR(100) | NOT NULL                  |                                    |
| last_name  | VARCHAR(100) | NOT NULL                  |                                    |
| email      | VARCHAR(255) | UNIQUE, NOT NULL          | Login identifier                   |
| password   | VARCHAR(255) | NOT NULL                  | bcrypt hash                        |
| role_id    | INT          | FK → `roles.id`           |                                    |
| is_active  | BOOLEAN      | NOT NULL, default `true`  | Lock flag for compromised accounts |
| created_at | TIMESTAMP    | NOT NULL, default `now()` |                                    |
| deleted_at | TIMESTAMP    | nullable                  | Soft-delete marker                 |

### 7.5 `refresh_tokens`

Active refresh-token registry. Allows per-session revocation.

| Field      | Type         | Constraints                        | Notes                      |
| ---------- | ------------ | ---------------------------------- | -------------------------- |
| id         | INT          | PK, auto-increment                 |                            |
| user_id    | INT          | FK → `users.id`, ON DELETE CASCADE |                            |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL                   | SHA-256 of the raw token   |
| expires_at | TIMESTAMP    | NOT NULL                           | Typically `now() + 7 days` |
| revoked_at | TIMESTAMP    | nullable                           | Logout or forced kill      |
| created_at | TIMESTAMP    | NOT NULL, default `now()`          |                            |

### 7.6 `categories`

Groups items by type.

| Field       | Type            | Constraints        | Notes                                |
| ----------- | --------------- | ------------------ | ------------------------------------ |
| id          | INT             | PK, auto-increment |                                      |
| name        | VARCHAR(100)    | UNIQUE, NOT NULL   |                                      |
| type        | `ItemType` enum | NOT NULL           | `EQUIPMENT`, `CONSUMABLE`, `DIGITAL` |
| description | TEXT            | nullable           |                                      |
| deleted_at  | TIMESTAMP       | nullable           | Soft-delete marker                   |

### 7.7 `items`

Master catalog. Extended 1:1 by `equipment` or `digital_assets` depending on type.

| Field         | Type              | Constraints                  | Notes                        |
| ------------- | ----------------- | ---------------------------- | ---------------------------- |
| id            | INT               | PK, auto-increment           |                              |
| item_name     | VARCHAR(255)      | NOT NULL                     |                              |
| description   | TEXT              | nullable                     |                              |
| category_id   | INT               | FK → `categories.id`         |                              |
| unit          | VARCHAR(50)       | NOT NULL                     | e.g., `pcs`, `ream`          |
| quantity      | INT               | NOT NULL, default 0          | Must be ≥ 0 (enforce in app) |
| reorder_point | INT               | NOT NULL, default 0          | Threshold for `LOW_STOCK`    |
| status        | `ItemStatus` enum | NOT NULL, default `IN_STOCK` |                              |
| barcode       | VARCHAR(255)      | UNIQUE, nullable             | QR / barcode reference       |
| image_url     | VARCHAR(500)      | nullable                     | S3 URL                       |
| registered_by | INT               | FK → `users.id`, nullable    | Audit reference              |
| created_at    | TIMESTAMP         | NOT NULL, default `now()`    |                              |
| updated_at    | TIMESTAMP         | NOT NULL, ON UPDATE          |                              |
| deleted_at    | TIMESTAMP         | nullable                     | Soft-delete marker           |

### 7.8 `equipment`

One row per physical unit. Extends `items` 1:1.

| Field             | Type                   | Constraints                   | Notes                                  |
| ----------------- | ---------------------- | ----------------------------- | -------------------------------------- |
| id                | INT                    | PK, auto-increment            |                                        |
| item_id           | INT                    | FK → `items.id`, UNIQUE       | Strict 1:1                             |
| asset_id          | VARCHAR(100)           | UNIQUE, NOT NULL              | System-generated (e.g., `JIT-EQ-0042`) |
| serial_number     | VARCHAR(100)           | UNIQUE, nullable              | Manufacturer serial                    |
| brand             | VARCHAR(255)           | nullable                      |                                        |
| model             | VARCHAR(255)           | nullable                      |                                        |
| condition         | `ConditionStatus` enum | NOT NULL, default `NEW`       |                                        |
| status            | `EquipmentStatus` enum | NOT NULL, default `AVAILABLE` |                                        |
| location          | VARCHAR(255)           | nullable                      | Storage location                       |
| assigned_to       | INT                    | FK → `users.id`, nullable     | Long-term assignment (not borrow)      |
| acquisition_date  | DATE                   | nullable                      |                                        |
| purchase_price    | DECIMAL(10,2)          | nullable                      |                                        |
| warranty_start    | DATE                   | nullable                      |                                        |
| warranty_end      | DATE                   | nullable                      | Drives expiry notifications            |
| warranty_provider | VARCHAR(255)           | nullable                      |                                        |
| warranty_doc_url  | VARCHAR(500)           | nullable                      | S3 URL                                 |
| created_at        | TIMESTAMP              | NOT NULL, default `now()`     |                                        |
| updated_at        | TIMESTAMP              | NOT NULL, ON UPDATE           |                                        |

### 7.9 `digital_assets`

Software licenses, subscriptions, domains, API keys. Extends `items` 1:1.

| Field           | Type                    | Constraints                | Notes                                                                                  |
| --------------- | ----------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| id              | INT                     | PK, auto-increment         |                                                                                        |
| item_id         | INT                     | FK → `items.id`, UNIQUE    |                                                                                        |
| asset_type      | `DigitalAssetType` enum | NOT NULL                   |                                                                                        |
| url             | VARCHAR(500)            | nullable                   | Admin console URL                                                                      |
| vendor          | VARCHAR(255)            | nullable                   |                                                                                        |
| license_key     | TEXT                    | nullable                   | **Must be encrypted at rest — see [Section 11](#11-open-questions--decisions-needed)** |
| credentials_ref | VARCHAR(255)            | nullable                   | Pointer to a secrets-manager entry; no passwords stored here                           |
| seats           | INT                     | nullable                   | `NULL` = unlimited                                                                     |
| expiry_date     | DATE                    | nullable                   | Drives renewal notifications                                                           |
| cost            | DECIMAL(10,2)           | nullable                   |                                                                                        |
| billing_cycle   | `BillingCycle` enum     | nullable                   |                                                                                        |
| status          | `DigitalStatus` enum    | NOT NULL, default `ACTIVE` |                                                                                        |
| notes           | TEXT                    | nullable                   |                                                                                        |
| created_at      | TIMESTAMP               | NOT NULL, default `now()`  |                                                                                        |
| updated_at      | TIMESTAMP               | NOT NULL, ON UPDATE        |                                                                                        |

### 7.10 `suppliers`

External vendor profiles.

| Field          | Type         | Constraints               | Notes              |
| -------------- | ------------ | ------------------------- | ------------------ |
| id             | INT          | PK, auto-increment        |                    |
| supplier_name  | VARCHAR(255) | NOT NULL                  |                    |
| contact_person | VARCHAR(255) | nullable                  |                    |
| email          | VARCHAR(255) | nullable                  |                    |
| phone          | VARCHAR(50)  | nullable                  |                    |
| address        | TEXT         | nullable                  |                    |
| created_at     | TIMESTAMP    | NOT NULL, default `now()` |                    |
| updated_at     | TIMESTAMP    | NOT NULL, ON UPDATE       |                    |
| deleted_at     | TIMESTAMP    | nullable                  | Soft-delete marker |

### 7.11 `purchase_orders`

Vendor transaction agreements.

| Field          | Type                       | Constraints               | Notes                                                                                    |
| -------------- | -------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| id             | INT                        | PK, auto-increment        |                                                                                          |
| supplier_id    | INT                        | FK → `suppliers.id`       |                                                                                          |
| invoice_number | VARCHAR(100)               | UNIQUE, nullable          | Vendor's invoice reference                                                               |
| status         | `PurchaseOrderStatus` enum | default `DRAFT`           |                                                                                          |
| total_amount   | DECIMAL(10,2)              | NOT NULL                  | Sum of line items; sync strategy: see [Section 11](#11-open-questions--decisions-needed) |
| receipt_url    | VARCHAR(500)               | nullable                  | S3 URL for invoice PDF                                                                   |
| created_by_id  | INT                        | FK → `users.id`           |                                                                                          |
| order_date     | TIMESTAMP                  | NOT NULL, default `now()` |                                                                                          |
| created_at     | TIMESTAMP                  | NOT NULL, default `now()` |                                                                                          |
| updated_at     | TIMESTAMP                  | NOT NULL, ON UPDATE       |                                                                                          |

### 7.12 `purchase_order_items`

Line items inside a PO.

| Field             | Type          | Constraints                                  | Notes                    |
| ----------------- | ------------- | -------------------------------------------- | ------------------------ |
| id                | INT           | PK, auto-increment                           |                          |
| purchase_order_id | INT           | FK → `purchase_orders.id`, ON DELETE CASCADE |                          |
| item_id           | INT           | FK → `items.id`                              |                          |
| quantity          | INT           | NOT NULL                                     |                          |
| unit_cost         | DECIMAL(10,2) | NOT NULL                                     |                          |
| (composite)       |               | UNIQUE(purchase_order_id, item_id)           | One line per item per PO |

### 7.13 `stock_in`

Inbound stock transactions.

| Field             | Type      | Constraints                         | Notes                     |
| ----------------- | --------- | ----------------------------------- | ------------------------- |
| id                | INT       | PK, auto-increment                  |                           |
| item_id           | INT       | FK → `items.id`                     |                           |
| quantity_added    | INT       | NOT NULL                            |                           |
| purchase_order_id | INT       | FK → `purchase_orders.id`, nullable | `NULL` for non-PO seeding |
| received_by_id    | INT       | FK → `users.id`                     |                           |
| notes             | TEXT      | nullable                            |                           |
| created_at        | TIMESTAMP | NOT NULL, default `now()`           |                           |

### 7.14 `stock_out`

Outbound stock transactions for consumables.

| Field            | Type      | Constraints               | Notes                  |
| ---------------- | --------- | ------------------------- | ---------------------- |
| id               | INT       | PK, auto-increment        |                        |
| item_id          | INT       | FK → `items.id`           |                        |
| quantity_removed | INT       | NOT NULL                  |                        |
| purpose          | TEXT      | NOT NULL                  | Required justification |
| released_by_id   | INT       | FK → `users.id`           |                        |
| notes            | TEXT      | nullable                  |                        |
| created_at       | TIMESTAMP | NOT NULL, default `now()` |                        |

### 7.15 `borrow_records`

Equipment lending lifecycle.

| Field            | Type                   | Constraints               | Notes                                 |
| ---------------- | ---------------------- | ------------------------- | ------------------------------------- |
| id               | INT                    | PK, auto-increment        |                                       |
| equipment_id     | INT                    | FK → `equipment.id`       |                                       |
| borrowed_by_id   | INT                    | FK → `users.id`           |                                       |
| approved_by_id   | INT                    | FK → `users.id`, nullable |                                       |
| borrow_date      | TIMESTAMP              | nullable                  | Set when approval flips to `BORROWED` |
| expected_return  | DATE                   | NOT NULL                  |                                       |
| actual_return    | TIMESTAMP              | nullable                  |                                       |
| return_condition | `ConditionStatus` enum | nullable                  | Set at return                         |
| status           | `BorrowStatus` enum    | default `PENDING`         |                                       |
| notes            | TEXT                   | nullable                  |                                       |
| created_at       | TIMESTAMP              | NOT NULL, default `now()` |                                       |
| updated_at       | TIMESTAMP              | NOT NULL, ON UPDATE       |                                       |

### 7.16 `maintenance_logs`

Repair, inspection, and service history per equipment unit.

| Field               | Type                     | Constraints               | Notes                |
| ------------------- | ------------------------ | ------------------------- | -------------------- |
| id                  | INT                      | PK, auto-increment        |                      |
| equipment_id        | INT                      | FK → `equipment.id`       |                      |
| description         | TEXT                     | NOT NULL                  |                      |
| status              | `MaintenanceStatus` enum | default `SCHEDULED`       |                      |
| scheduled_date      | DATE                     | nullable                  |                      |
| completed_date      | DATE                     | nullable                  |                      |
| cost                | DECIMAL(10,2)            | nullable                  |                      |
| performed_by_id     | INT                      | FK → `users.id`, nullable | Internal technician  |
| performed_by_vendor | VARCHAR(255)             | nullable                  | External vendor name |
| notes               | TEXT                     | nullable                  |                      |
| created_at          | TIMESTAMP                | NOT NULL, default `now()` |                      |
| updated_at          | TIMESTAMP                | NOT NULL, ON UPDATE       |                      |

### 7.17 `disposals`

Asset write-off records. Exactly one row per retired equipment unit.

| Field          | Type                  | Constraints                 | Notes                                |
| -------------- | --------------------- | --------------------------- | ------------------------------------ |
| id             | INT                   | PK, auto-increment          |                                      |
| equipment_id   | INT                   | FK → `equipment.id`, UNIQUE | One disposal per unit                |
| approved_by_id | INT                   | FK → `users.id`             | Must be an Admin                     |
| disposal_date  | TIMESTAMP             | NOT NULL, default `now()`   |                                      |
| reason         | `DisposalReason` enum | NOT NULL                    |                                      |
| method         | VARCHAR(100)          | NOT NULL                    | e.g., `e-waste recycler`, `donation` |
| notes          | TEXT                  | nullable                    |                                      |
| created_at     | TIMESTAMP             | NOT NULL, default `now()`   |                                      |

### 7.18 `inventory_logs`

Append-only audit log for tracked-table mutations.

| Field        | Type             | Constraints               | Notes                         |
| ------------ | ---------------- | ------------------------- | ----------------------------- |
| id           | INT              | PK, auto-increment        |                               |
| entity_type  | VARCHAR(50)      | NOT NULL                  | e.g., `Item`, `BorrowRecord`  |
| entity_id    | INT              | NOT NULL                  | Row PK of the affected entity |
| action       | `LogAction` enum | NOT NULL                  |                               |
| old_data     | JSON             | nullable                  | Snapshot before mutation      |
| new_data     | JSON             | nullable                  | Snapshot after mutation       |
| performed_by | INT              | FK → `users.id`           |                               |
| performed_at | TIMESTAMP        | NOT NULL, default `now()` |                               |

> **Append-only enforcement.** The log table has no `UPDATE` or `DELETE` permission granted to application roles. Only the migration/admin role can purge rows, and that purge is logged externally.

---

## 8. Non-Functional Requirements

### 8.1 Notifications

The system surfaces time-sensitive events via in-app dashboard widgets and email. Notifications are dispatched by a `node-cron` job inside the Express process (see [Section 11, Decision 8](#decision-8--scheduled-jobs-node-cron-inside-the-express-process)).

| Event                  | Trigger                                                             | Recipients                    |
| ---------------------- | ------------------------------------------------------------------- | ----------------------------- |
| Low stock              | `items.quantity <= reorder_point`                                   | Manager, Admin                |
| Overdue borrow         | `borrow_records.expected_return < now() AND actual_return IS NULL`  | Borrower + Manager            |
| Warranty expiring      | `equipment.warranty_end` within 30 days                             | Manager                       |
| Digital asset expiring | `digital_assets.expiry_date` within 30 days                         | Manager                       |
| Maintenance due        | `maintenance_logs.scheduled_date` within 7 days, status `SCHEDULED` | Assigned technician + Manager |

### 8.2 Audit & Retention

- `inventory_logs` is retained indefinitely in v1. Archival to cold storage is a v2 consideration.
- Soft-deleted rows (`deleted_at IS NOT NULL`) are retained indefinitely. They're excluded from default queries via Prisma middleware.

### 8.3 Performance Targets (initial)

- API median response time < 200 ms for read endpoints, < 500 ms for writes, under expected load (≤ 50 concurrent users).
- Page load (LCP) < 2.5 s on a typical office connection.
- These targets are first-cut and will be revisited after load testing.

### 8.4 Backup & Recovery

- Nightly PostgreSQL snapshots, retained for 30 days.
- Point-in-time recovery to within 5 minutes during the retention window.
- Object-store buckets versioned with a 90-day expiry on prior versions.

### 8.5 Observability

- Structured JSON logs from the API, shipped to a log aggregator (TBD).
- Health-check endpoint at `/healthz` returning DB connectivity and migration status.
- Error reporting via Sentry (or equivalent — TBD).

### 8.6 Time Zones

- All timestamps stored as UTC.
- The UI renders in the user's local time zone (browser default).
- Reports default to the company's primary office time zone.

### 8.7 Testing Strategy

- **Unit tests** for all service-layer logic (Vitest or Jest on the API).
- **Integration tests** for each REST endpoint, using a disposable test database.
- **E2E tests** for the critical workflows (login, borrow, return, PO approve+receive) using Playwright.
- CI runs all three on every PR.

---

## 9. Delivery Roadmap

### 9.1 Story-Point Scale

Story points measure complexity and risk, not hours.

| Points | Meaning    | Example                                                      |
| ------ | ---------- | ------------------------------------------------------------ |
| 1      | Trivial    | Renaming a button label                                      |
| 2      | Low effort | Adding a search filter to a list                             |
| 3      | Moderate   | Writing form-validation logic                                |
| 5      | Medium     | Building a filtered data table with server-side pagination   |
| 8      | High       | Implementing the full borrow-and-return workflow             |
| 13     | Structural | Building the RBAC subsystem end-to-end — must be broken down |

### 9.2 Eight-Week MVP Pipeline

**Iteration 1 — Weeks 1–2: Foundation**

- Scaffold the React + Vite client alongside the Express API.
- Wire up Prisma against PostgreSQL; apply the schema in Section 6.
- Implement auth (login, refresh, logout) and the dual-token model.
- Stand up Zustand auth store and the Axios refresh interceptor.

**Iteration 2 — Weeks 3–4: Inventory MVP**

- Category CRUD with validation.
- Item registration for all three types (equipment, consumable, digital).
- Asset ID generation for equipment.
- Catalog list view with search and filters.

**Iteration 3 — Weeks 5–6: Procurement & Borrow**

- Supplier CRUD and PO drafting with multi-line items.
- PO approval and receive flow with `stock_in` records.
- Borrow request, approval, handover, and return flow.
- File upload pipeline to the object store.

**Iteration 4 — Weeks 7–8: Maintenance, Disposal, Audit**

- Maintenance log creation, status transitions, completion.
- Disposal workflow with Admin approval and replacement-PO hook.
- Audit log (`inventory_logs`) wiring on all tracked tables via Prisma middleware.
- PDF and Excel exports for the main reports.

### 9.3 Definition of Done (per iteration)

- All endpoints have integration tests.
- All UI changes have at least one E2E happy-path test.
- Code review by one other engineer.
- Documentation updated (this spec, plus API reference).

---

## 10. Out of Scope (v1)

The following are deliberately deferred:

- Mobile native apps (a responsive web UI covers tablet/phone in v1).
- Barcode / QR code scanning from device cameras.
- Multi-warehouse or multi-location stock tracking.
- Multi-currency cost tracking.
- Internationalization (the UI is English-only in v1).
- Self-service password reset (Admins reset passwords in v1).
- SSO / SAML integration.
- Vendor self-service portal.
- Public REST API for third-party integrations.
- Automated procurement triggers (auto-create draft POs when stock is low).

---

## 11. Decisions & Local Development Setup

All questions from the previous draft have been resolved below. Hosting and cloud deployment are explicitly out of scope — the system runs locally for now, with a shared database instance used by the whole team throughout development and testing.

---

### 11.1 Resolved Decisions

#### Decision 1 — Local File & Image Storage: MinIO via Docker Compose

**Decision:** Run a [MinIO](https://min.io/) container alongside PostgreSQL in `docker-compose.yml`. MinIO is an S3-compatible object store that runs entirely on a local machine or LAN server.

**Rationale:** The upload pipeline in Section 3.3 uses the AWS SDK. With MinIO, the only change is setting the `endpoint` to `http://localhost:9000` (or the team host's IP) and `forcePathStyle: true`. The rest of the upload code is identical to what would run against real S3 — no throwaway code. When/if the system ever moves to a hosted environment, the SDK config is the only thing that changes.

**Implementation notes:**

- Add a `minio` service to `docker-compose.yml` alongside `postgres`.
- Expose ports `9000` (API) and `9001` (web console).
- Set `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` in `.env`.
- On first run, use the web console or `mc` CLI to create the required buckets (`jit-images`, `jit-docs`).
- The API reads `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_BUCKET` from `.env`.

---

#### Decision 2 — License-Key Encryption: pgcrypto (column-level)

**Decision:** Enable the `pgcrypto` PostgreSQL extension and use `pgp_sym_encrypt` / `pgp_sym_decrypt` with a symmetric application key to encrypt `digital_assets.license_key` at rest.

**Rationale:** pgcrypto is bundled with every standard PostgreSQL installation — no additional dependencies. The encryption key lives in `.env` as `ENCRYPTION_KEY` and is applied in the service layer before writes and after reads. The existing `credentials_ref` column is retained as an optional plaintext pointer for assets whose credentials live in an external tool (e.g., a team password manager) rather than directly in the database.

**Implementation notes:**

- Run `CREATE EXTENSION IF NOT EXISTS pgcrypto;` in the initial migration.
- The Prisma `license_key` field is typed as `String?`. Encryption/decryption is handled in a `digitalAssets` service wrapper — Prisma itself is not aware of it.
- Never log the decrypted value; only the encrypted ciphertext touches the database.

---

#### Decision 3 — Equipment Quantity Sync: Application code in a transaction

**Decision:** `items.quantity` for equipment-type items is updated by application code within the same Prisma transaction as any operation that changes the count of available `equipment` rows.

**Rationale:** Database triggers and generated columns add invisible schema behaviour that is hard to trace during early development and requires raw SQL outside Prisma's type system. Keeping the logic in the service layer means the behaviour is readable, testable, and debuggable without leaving TypeScript.

**Implementation notes:**

- The `equipmentService` wraps the following in a single `prisma.$transaction`:
  - Creating a new `equipment` row increments `items.quantity`.
  - Setting `equipment.status` to `RETIRED`, `LOST`, or any terminal status decrements `items.quantity`.
  - Bulk registration (multiple units at once) does one batch insert then one `UPDATE items SET quantity = <count>`.
- A helper `syncEquipmentCount(itemId, tx)` re-counts available rows and writes the result, used wherever the count could be dirty.

---

#### Decision 4 — PO `total_amount` Sync: Application code in a transaction

**Decision:** `purchase_orders.total_amount` is a stored field recalculated by application code whenever a `purchase_order_items` row is created, updated, or deleted.

**Rationale:** Same reasoning as Decision 3 — the calculation `SUM(quantity × unit_cost)` is trivial and belongs in the service layer where it is visible and testable.

**Implementation notes:**

- The `purchaseOrderService` runs `SUM(poi.quantity * poi.unit_cost)` in the same transaction as any line-item mutation and writes the result back to `purchase_orders.total_amount`.
- A helper `recalculatePOTotal(purchaseOrderId, tx)` is the single canonical function called by all line-item mutations (create, update, delete).

---

#### Decision 5 — Soft-Delete Consistency: Add `deleted_at` to `equipment` and `digital_assets`

**Decision:** Add `deletedAt DateTime? @map("deleted_at")` to both `equipment` and `digital_assets` to match the pattern on `users`, `items`, `categories`, and `suppliers`.

**Rationale:** The Prisma middleware that excludes soft-deleted rows from default queries uses `where: { deletedAt: null }`. Covering all top-level entities with the same pattern means one middleware rule handles everything. Status enums (`RETIRED`, `CANCELLED`) are retained for active lifecycle tracking within those tables and mean something different from soft deletion (e.g., `RETIRED` equipment can still be queried for history; a soft-deleted row should not appear at all in normal use).

**Schema changes required:**

```prisma
model Equipment {
  // ... existing fields ...
  deletedAt  DateTime?  @map("deleted_at")
}

model DigitalAsset {
  // ... existing fields ...
  deletedAt  DateTime?  @map("deleted_at")
}
```

---

#### Decision 6 — `assigned_to` vs `borrow_records`: Keep both, enforce mutual exclusion

**Decision:** Both fields are kept. They cover distinct use cases:

|                 | `equipment.assigned_to`                                                                | `borrow_records`                                                        |
| --------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Use case**    | Long-term or permanent assignment (e.g., a laptop that is Alice's primary workstation) | Short-term, time-bounded loan (e.g., borrowing a camera for three days) |
| **Return date** | None — no expected return                                                              | Required (`expected_return`)                                            |
| **Who sets it** | Manager, via a direct assignment action                                                | Initiated by Staff, approved by Manager                                 |
| **UI label**    | "Assigned to"                                                                          | "Borrow request"                                                        |

**Constraint enforced at the service layer:** An equipment unit that has a non-null `assigned_to` cannot have an open (non-terminal) `borrow_record`, and vice versa. The service throws a validation error if both are attempted simultaneously.

---

#### Decision 7 — `LogAction` BORROWED / RETURNED overlap: Written explicitly at the service layer

**Decision:** Audit log entries are written explicitly by each service handler at the point of each status transition — they are not derived automatically from entity state.

**Rationale:** The `BorrowStatus` enum tracks the current state of a record. `LogAction` tracks what happened at a point in time. A borrow workflow produces multiple distinct log entries (`APPROVED`, then `BORROWED`, then `RETURNED`) — if the logger inferred action from current status it would only ever see the final state. Explicit logging also makes it easy to include extra context (e.g., `oldData`, `newData`) in each entry.

**Pattern:**

```typescript
// Inside borrowService.markBorrowed(id, performedBy):
await prisma.$transaction(async (tx) => {
  await tx.borrowRecord.update({
    where: { id },
    data: { status: 'BORROWED', borrowDate: new Date() },
  });
  await tx.equipment.update({ where: { id: record.equipmentId }, data: { status: 'BORROWED' } });
  await auditLog(tx, {
    entityType: 'borrow_records',
    entityId: id,
    action: 'BORROWED',
    performedBy,
  });
});
```

---

#### Decision 8 — Scheduled Jobs: `node-cron` inside the Express process

**Decision:** Scheduled jobs run as `node-cron` tasks registered at API startup. No separate worker process is needed for local development.

**Jobs and cadence:**

| Job                      | Schedule       | Action                                                                                                                                                   |
| ------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overdue borrow detection | Every hour     | Set `borrow_records.status = OVERDUE` where `expected_return < now() AND actual_return IS NULL`                                                          |
| Digital asset expiry     | Daily at 01:00 | Set `digital_assets.status = EXPIRED` where `expiry_date < today AND status = ACTIVE`                                                                    |
| Notification dispatch    | Daily at 08:00 | Query low stock, overdue borrows, warranty expiry (30d), digital asset expiry (30d), and maintenance due (7d); send emails via MailDev (see Decision 11) |

**Rationale:** A separate worker process adds Docker Compose complexity (another service, health-checks, shared DB connection pool) for no benefit at this stage. If the system is later moved to a hosted environment, the cron module can be extracted into a standalone script without architectural changes.

---

#### Decision 9 — Digital Asset Renewal Model: Update existing row

**Decision:** Renewal updates the existing `digital_assets` row (new `expiry_date`, incremented `renewal_count`) and writes a `LogAction.RENEWED` entry to `inventory_logs`.

**Rationale:** Creating a new row on each renewal would break the 1:1 `items ↔ digital_assets` constraint and inflate the catalog with duplicate entries for what is logically the same asset. Historical renewal dates are preserved in the audit log (`inventory_logs.newData` captures the updated `expiry_date` and `renewal_count` on every `RENEWED` entry).

**Schema change required — add `renewal_count` to `digital_assets`:**

```prisma
model DigitalAsset {
  // ... existing fields ...
  renewalCount  Int  @default(0) @map("renewal_count")
}
```

---

#### Decision 10 — Asset ID Format: `JIT-EQ-NNNN` confirmed

**Decision:** The Asset ID format `JIT-EQ-NNNN` (zero-padded to 4 digits) is confirmed for all equipment regardless of category. A single global auto-increment sequence is used — no category-based prefix variation in v1.

**Rationale:** Per-category prefixes (`JIT-LAPTOP-0001`, `JIT-MON-0002`) require a sequence-per-category and add lookup complexity. A single sequence is simpler to implement and keeps IDs collision-free without coordination. Category is already captured in `items.categoryId`; it does not need to be encoded in the tag.

**Generation logic:** On `equipment` row creation, the service queries `MAX(asset_id)` within the `JIT-EQ-` namespace, increments, and zero-pads. If no rows exist, the sequence starts at `JIT-EQ-0001`.

---

#### Decision 11 — Email for Local Development: MailDev via Docker Compose

**Decision:** Add a `maildev` container to `docker-compose.yml`. The API uses Nodemailer configured to deliver to MailDev's local SMTP port. All notification emails are captured and viewable in the MailDev web UI — nothing is sent externally.

**Implementation notes:**

- MailDev exposes SMTP on port `1025` and the web inbox on port `1080`.
- Add `SMTP_HOST=localhost`, `SMTP_PORT=1025` to `.env`. Nodemailer transport uses these values.
- No authentication required for MailDev.
- Visit `http://localhost:1080` to inspect all outgoing mail during development.

---

### 11.2 Local Development Database Sharing

Since the team shares a single database throughout local development and testing, the following setup applies.

#### Infrastructure: Docker Compose

A `docker-compose.yml` at the repository root defines three services: `postgres`, `minio`, and `maildev`. Any team member (or a designated team machine on the LAN) runs:

```bash
docker compose up -d
```

Everyone else on the team sets their `.env` `DATABASE_URL` (and MinIO/SMTP variables) to point at that host's IP address.

#### `.env` conventions

The repository ships an `.env.example` listing every required key with placeholder values. Actual values are distributed once via the team password manager and stored locally as `.env` (never committed).

```
# .env.example
DATABASE_URL=postgresql://jit_user:changeme@<host-ip>:5432/jit_db
ENCRYPTION_KEY=changeme-min-32-chars
JWT_ACCESS_SECRET=changeme
JWT_REFRESH_SECRET=changeme
S3_ENDPOINT=http://<host-ip>:9000
S3_ACCESS_KEY=changeme
S3_SECRET_KEY=changeme
S3_BUCKET=jit-images
SMTP_HOST=<host-ip>
SMTP_PORT=1025
```

#### Migration workflow

Migrations are managed by Prisma and applied to the shared instance. The team member who authors a migration PR is responsible for running `prisma migrate deploy` against the shared database after the PR is merged. The PR description must note whether a migration is included so teammates know to expect a schema change.

New team members joining the project run:

```bash
npm install
cp .env.example .env        # fill in values from password manager
npx prisma migrate deploy   # apply all pending migrations
npx prisma db seed          # seed roles, permissions, and default admin user
```

#### Test database

Integration tests (see Section 8.7) run against a separate test database (`jit_db_test`) on the same shared PostgreSQL instance — not the development database. The test runner sets `DATABASE_URL` to the test database via an environment override before each suite, and Prisma's `migrate reset` wipes and re-seeds it at the start of each test run.

---

## 12. Change Log

| Version | Date       | Author        | Notes                                                                                                                                                                                               |
| ------- | ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.0     | _original_ | _unspecified_ | Initial AI-assisted draft                                                                                                                                                                           |
| 4.2     | _TBD_      | _TBD_         | Resolved all open questions in Section 11; removed hosting/cloud question (out of scope); added local dev database-sharing setup; added MinIO, MailDev, renewal_count, and soft-delete schema notes |
