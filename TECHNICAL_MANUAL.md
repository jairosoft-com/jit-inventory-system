# JIT Inventory & Equipment Management System — Technical Manual

Welcome to the **Technical Manual** for the JIT Inventory & Equipment Management System. This manual serves as the single source of truth for the system's technical stack, database schema design, credentials/environment configuration, UI/UX design tokens, design processes, and core operational workflows.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Technical Stack](#2-technical-stack)
   - [2.1 Project Structure](#21-project-structure)
   - [2.2 Backend Architecture](#22-backend-architecture)
   - [2.3 Production Deployment (Docker Compose)](#23-production-deployment-docker-compose)
3. [Database Design](#3-database-design)
4. [Credentials & Environment Configuration](#4-credentials--environment-configuration)
5. [UI/UX Design Manual (Cortez Reference)](#5-uiux-design-manual-cortez-reference)
   - [5.1 Typography](#51-typography)
   - [5.2 Color Palette](#52-color-palette)
   - [5.3 Buttons](#53-buttons)
   - [5.4 Cards](#54-cards)
   - [5.5 Icons](#55-icons)
   - [5.6 Logo](#56-logo)
   - [5.7 Design Process & Principles](#57-design-process--principles)
6. [User Roles & Permissions Matrix](#6-user-roles--permissions-matrix)
7. [System Workflows & Lifecycle Operators](#7-system-workflows--lifecycle-operators)
   - [7.1 Getting Started & Authentication](#71-getting-started--authentication)
   - [7.2 Dashboard & Alerts Quick Guide](#72-dashboard--alerts-quick-guide)
   - [7.3 Inventory & Category Management](#73-inventory--category-management)
   - [7.4 Equipment Borrowing Lifecycle](#74-equipment-borrowing-lifecycle)
   - [7.5 Equipment Maintenance & Repairs](#75-equipment-maintenance--repairs)
   - [7.6 Equipment Disposal](#76-equipment-disposal)
   - [7.7 Procurement & Purchase Orders (PO)](#77-procurement--purchase-orders-po)
   - [7.8 Reports & System Audit Trail](#78-reports--system-audit-trail)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. Introduction

The JIT Inventory & Equipment Management System is a centralized, internal web application designed for Jairosoft, Inc. to automate the full lifecycle of physical assets (equipment, bulk consumables) and digital assets (software licenses, domain registrations). It replaces manual spreadsheets with a secure, auditable digital database and request-approval pipelines.

This manual combines structural development specifications and Figma design guidelines into a single reference for developers, system administrators, and onboarding teams.

---

## 2. Technical Stack

The JIT Inventory System is built on a modern, type-safe monorepo architecture managed via Turborepo:

### Core Frameworks

- **Frontend**: Built with **React 19** and **Vite** as a fast Single Page Application (SPA), utilizing **React Router v7** for routing.
- **Styling**: Powered by **Tailwind CSS v4** utilizing custom design tokens mapped to the Figma design system.
- **Backend**: A RESTful **Express** API built with **TypeScript** and structured into modular route, service, and controller layers.
- **ORM**: **Prisma ORM** serves as the type-safe connection and query client between Node.js and the database.

### Infrastructure & Services

- **Database**: **PostgreSQL** handles relational storage (users, catalog, purchase orders, audits).
- **Caching & Caching-aside Storage**: **Redis** is integrated for performance caching:
  - **User Active Status Caching**: Caches user active status with a 60-second TTL to avoid database lookups on every request.
  - **Permissions Caching**: Caches RBAC role permissions (5-minute TTL) to minimize query latency on authenticated middleware.
- **File Storage**: Uses a local **MinIO** container (S3-compatible API) to serve media assets and attachments, prepared for direct production S3 migrations.
- **Rate Limiting**: Employs **Redis-backed rate limiters** (`rate-limit-redis`) to prevent brute-force attacks and abuse on authenticated and mutative endpoints.
- **Email Engine**: Integrates an SMTP client configured by default to point to **MailDev** in local dev, allowing secure staging of automated notifications.
- **Reverse Proxy & Load Balancing**: **Nginx** handles reverse proxying on port 80 in production setups, routing root `/` requests to static frontend assets and `/api/*` requests directly to backend API containers.

### 2.1 Project Structure

The codebase is organized as a type-safe monorepo using **Turborepo** with NPM workspaces:

```
jit-inventory-system/
├── apps/
│   ├── frontend/         # Vite + React 19 + Tailwind CSS v4 application
│   └── backend/          # Express + TypeScript + Prisma API service
├── packages/
│   └── shared/           # Shared interfaces, types, and constants
├── prisma/
│   ├── schema.prisma     # Database schema (single source of truth)
│   └── seed.ts           # RBAC permissions and default user seed data
├── .github/
│   └── workflows/
│       └── ci.yml        # CI lint, type-check, and build pipeline
├── turbo.json            # Turborepo task pipeline configuration
├── package.json          # Monorepo root workspace configuration
└── tsconfig.base.json    # Shared compiler configuration
```

### 2.2 Backend Architecture

The Express backend application is structured into distinct logical layers to enforce separation of concerns and maintainability:

- **Routes** (`apps/backend/src/routes/`): Defines HTTP endpoints, registers Zod payload schemas, and wires middleware functions.
- **Services** (`apps/backend/src/services/`): Implements business logic, validation rules, and direct database queries via the Prisma client.
- **Middlewares** (`apps/backend/src/middleware/`): Holds route guards and lifecycle hooks:
  - `authenticate`: Verifies access JWT tokens.
  - `authorize`: Restricts access to specific endpoints using RBAC.
  - `validate`: Uses Zod schemas to validate request payloads before hitting service controllers.
- **Schemas** (`apps/backend/src/schemas/`): Zod object schemas representing expected request structures.
- **Types** (`apps/backend/src/types/`): Custom TS type definitions and Express request extensions.

### 2.3 Production Deployment (Docker Compose)

The application includes a production-ready containerized deployment configuration. Nginx routes all public HTTP traffic, serving static assets from the frontend and proxying API endpoints.

1.  **Build and Run the Services**:
    Builds the production Docker containers for frontend, backend, postgres, redis, minio, and maildev, and runs them in detached mode:
    ```bash
    docker compose up --build -d
    ```
2.  **Initialize PostgreSQL Database**:
    Execute database migrations and seeds inside the running backend container:
    ```bash
    docker compose exec backend npm run db:migrate
    ```
3.  **Access Points**:
    - **Main Application**: Open `http://localhost` (default port 80).
    - **SMTP Mail Inspector (MailDev)**: Open `http://localhost:1080` to view captured outgoing system emails.

---

## 3. Database Design

The relational database schema is configured in [schema.prisma](file:///c:/Users/Admin/Desktop/jit-inventory-system/prisma/schema.prisma) and is organized around six logical modules:

1.  **Identity, RBAC & Auth**: `roles`, `permissions`, `role_permissions`, `users`, and `refresh_tokens`.
2.  **Product Catalog**: `categories` and `items` (which hold general metadata for all products).
3.  **Typed Asset Profiles**: Extensions linked one-to-one to items:
    - `consumable_profiles` tracks bulk consumables quantities and reorder thresholds.
    - `equipment` tracks physical serialized gear (brand, condition, warranty dates).
    - `digital_assets` tracks licenses (license keys, seats, costs).
4.  **Procurement Pipeline**: `suppliers`, `purchase_orders`, `purchase_order_items`, `purchase_order_history`, and `purchase_order_attachments`.
5.  **Asset Operations & Movements**:
    - `stock_in`, `stock_out`, `stock_adjustments`, and `stock_movements` for bulk item counts.
    - `borrow_records` for the equipment check-out workflow.
    - `maintenance_logs` and `maintenance_alerts` for scheduled repairs.
    - `disposals` for decommissioning obsolete or broken assets.
6.  **Audit Logs & Alerts**: `inventory_logs`, `inventory_alerts`, and `procurement_alerts`.

### Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    Role ||--o{ RolePermission : "has"
    Permission ||--o{ RolePermission : "defines"
    Role ||--o{ User : "assigns"
    User ||--o{ RefreshToken : "issues"
    User ||--o{ Item : "registers"
    User ||--o{ BorrowRecord : "requests"
    User ||--o{ BorrowRecord : "approves"
    User ||--o{ Disposal : "approves"
    User ||--o{ PurchaseOrder : "creates"
    User ||--o{ MaintenanceLog : "performs"
    User ||--o{ StockMovement : "performs"
    Category ||--o{ Item : "classifies"
    Item ||--o| ConsumableProfile : "extends"
    Item ||--o| Equipment : "extends"
    Item ||--o| DigitalAsset : "extends"
    Equipment ||--o{ BorrowRecord : "borrows"
    Equipment ||--o{ MaintenanceLog : "logs"
    Equipment ||--o| Disposal : "disposes"
    Supplier ||--o{ PurchaseOrder : "supplies"
    PurchaseOrder ||--o{ PurchaseOrderItem : "contains"
    Item ||--o{ PurchaseOrderItem : "ordered_in"
    PurchaseOrder ||--o{ PurchaseOrderHistory : "tracks"
    ConsumableProfile ||--o{ StockIn : "receives"
    ConsumableProfile ||--o{ StockOut : "releases"
    ConsumableProfile ||--o{ StockAdjustment : "adjusts"
    ConsumableProfile ||--o{ StockMovement : "logs"
    Item ||--o{ ItemImage : "has"
    Equipment ||--o{ EquipmentImage : "has"
    User ||--o{ InventoryLog : "performs"
    ConsumableProfile ||--o{ InventoryAlert : "triggers"
    Equipment ||--o{ InventoryAlert : "triggers"
    BorrowRecord ||--o{ InventoryAlert : "triggers"
    MaintenanceLog ||--o{ MaintenanceAlert : "notifies"
    PurchaseOrder ||--o{ ProcurementAlert : "notifies"
    PurchaseOrder ||--o{ PurchaseOrderAttachment : "attaches"
```

---

## 4. Credentials & Environment Configuration

System configuration is driven entirely by environment variables stored in a localized `.env` file (never committed to git). See [`.env.example`](file:///c:/Users/Admin/Desktop/jit-inventory-system/.env.example) for reference.

### Required Configuration Keys

| Section                 | Key Name              | Purpose                                      | Example Value / Default                                                        |
| :---------------------- | :-------------------- | :------------------------------------------- | :----------------------------------------------------------------------------- |
| **Database**            | `DATABASE_URL`        | PostgreSQL connection string                 | `postgresql://jit_user:jit_password@localhost:5432/jit_db?connection_limit=20` |
| **PostgreSQL (Docker)** | `POSTGRES_USER`       | Admin user for Docker PostgreSQL             | `jit_user`                                                                     |
|                         | `POSTGRES_PASSWORD`   | Password for Docker PostgreSQL               | `jit_password`                                                                 |
|                         | `POSTGRES_DB`         | Default database name                        | `jit_db`                                                                       |
| **Security & JWT**      | `JWT_ACCESS_SECRET`   | Signing key for short-lived access JWTs      | _Secure random string_                                                         |
|                         | `JWT_REFRESH_SECRET`  | Signing key for long-lived refresh JWTs      | _Secure random string_                                                         |
|                         | `JWT_ACCESS_EXPIRY`   | Access token lifespan                        | `15m`                                                                          |
|                         | `JWT_REFRESH_EXPIRY`  | Refresh token lifespan                       | `7d`                                                                           |
|                         | `ENCRYPTION_KEY`      | Key for symmetric license key encryption     | _Symmetric key (min 32 characters)_                                            |
| **Storage (MinIO/S3)**  | `S3_ACCESS_KEY`       | Access key for MinIO/S3 container            | `changeme`                                                                     |
|                         | `S3_SECRET_KEY`       | Secret key for MinIO/S3 container            | `changeme`                                                                     |
|                         | `S3_BUCKET`           | Upload container bucket name                 | `jit-images`                                                                   |
| **SMTP (Email)**        | `SMTP_HOST`           | Host IP address of the SMTP service          | `localhost` (MailDev)                                                          |
|                         | `SMTP_PORT`           | Listening port for SMTP client               | `1025`                                                                         |
|                         | `SMTP_FROM`           | Default sender email address                 | `JIT Inventory System <noreply@jitims.com>`                                    |
|                         | `SMTP_USER`           | Optional SMTP username                       | _(empty)_                                                                      |
|                         | `SMTP_PASS`           | Optional SMTP password                       | _(empty)_                                                                      |
|                         | `SMTP_SECURE`         | Enables TLS connection (true/false)          | `false`                                                                        |
| **Backend API**         | `BACKEND_PORT`        | Port the backend process listens on          | `3001`                                                                         |
|                         | `CORS_ORIGIN`         | Allowed cross-origin request origin          | `http://localhost:3000`                                                        |
|                         | `COOKIE_SECURE`       | Enables browser `Secure` flag on JWT cookies | `false` (dev/http), `true` (prod/https)                                        |
| **Frontend Web**        | `VITE_API_URL`        | Base endpoint URL for client requests        | `http://localhost:3001/api`                                                    |
| **Rate Limiting**       | `RATE_LIMIT_GLOBAL`   | Requests per 15 mins (global)                | `600`                                                                          |
|                         | `RATE_LIMIT_MUTATIVE` | Requests per 15 mins (writes)                | `120`                                                                          |
|                         | `RATE_LIMIT_AUTH`     | Requests per 15 mins (login attempts)        | `999999` (development override)                                                |
|                         | `RATE_LIMIT_HEAVY`    | Requests per 15 mins (reports/dashboard)     | `200`                                                                          |
| **Cache (Redis)**       | `REDIS_URL`           | Redis connection URL                         | `redis://localhost:6379`                                                       |
| **Seed Credentials**    | `SEED_ADMIN_EMAIL`    | Admin account email for prisma seed          | `sam@jitims.com`                                                               |
|                         | `SEED_ADMIN_PASSWORD` | Admin account password for prisma seed       | _(cryptographically generated if empty)_                                       |

### Default Seed Credentials (Local Development)

The database seed script ([seed.ts](file:///c:/Users/Admin/Desktop/jit-inventory-system/prisma/seed.ts)) sets up baseline RBAC mappings and spawns three default testing accounts:

1.  **Admin Account (Full Unrestricted Access)**
    - **Email**: Defined by the `SEED_ADMIN_EMAIL` environment variable (defaults to `sam@jitims.com`).
    - **Password**: Defined by the `SEED_ADMIN_PASSWORD` variable. If not defined, a secure random key is auto-generated and logged to the terminal console during seed operations.
2.  **Manager Account (Operational Control)**
    - **Email**: `manager@jitims.com`
    - **Password**: `password123`
3.  **Staff Account (End-user Request Only)**
    - **Email**: `staff@jitims.com`
    - **Password**: `password123`

---

## 5. UI/UX Design Manual (Cortez Reference)

Prepared by Jez Cortez | UI/UX Design, Jairosoft, Inc. OJT. Figma File: JIT Inventory.

### 5.1 Typography

The JIT Inventory System uses a single typeface, **Poppins**, to maintain a sleek, unified, and legible interface layout.

- **Type Scale**:
  - **Headings**: Runs from `Heading 1` down to `Heading 5`, providing a clear hierarchy for titles, panel sections, and sub-labels.
  - **Body Copy**: Utilizes three specific sizes: `text-large`, `text-base`, and `text-medium` for descriptive and status indicators.
- **Font Weights**: Every heading and text classification supports four standard weights: **Bold**, **Medium**, **Regular**, and **Light**.
- **Token Naming Convention**:
  - `heading{1–5} / {bold | medium | regular | light}`
  - `text-{large | base | medium} / {bold | medium | regular | light}`

### 5.2 Color Palette

Colors are structured semantically into seven primary scales. Each functional color is mapped to a gradient scale (100–700 or 50-900) to ensure consistent usage for backgrounds, borders, hover/focus, and text elements.

- **Neutral (Base: #FCFCFD)**: Utilized for layout surfaces, card containers, page backdrops, and body text.
  - `neutral-50` (#FCFCFD) | `neutral-100` (#F1F3F6) | `neutral-200` (#E0E4EA) | `neutral-300` (#C8CED9) | `neutral-400` (#A8B3C4) | `neutral-500` (#8292AA) | `neutral-550` (#8091AE) | `neutral-600` (#5B6B86) | `neutral-700` (#384252) | `neutral-800` (#242B35) | `neutral-900` (#191D24)
- **Primary (Base: #346BEB)**: System actions, primary prompts, and interactive focus states.
  - `primary-100` (#EEF3FD) | `primary-200` (#DAE4FB) | `primary-300` (#BDCFF8) | `primary-400` (#98B4F5) | `primary-500` (#6A92F0) | `primary-600` (#346BEB) | `primary-700` (#144AC8)
- **Secondary (Base: #263180)**: Headers, persistent navigation sidebars, and accent frames.
  - `secondary-100` (#E9EBF9) | `secondary-200` (#CED2F0) | `secondary-300` (#A9B0E5) | `secondary-400` (#7883D7) | `secondary-500` (#3D4DC5) | `secondary-600` (#263180) | `secondary-700` (#0E122F)
- **Success (Base: #45A473)**: Valid states, completed indicators, and available assets.
  - `success-100` (#EFF8F4) | `success-200` (#DBF0E5) | `success-300` (#BFE4D1) | `success-400` (#9BD5B7) | `success-500` (#6FC398) | `success-600` (#45A473) | `success-700` (#2C6849)
- **Warning (Base: #FFB126)**: Alerts, pending approvals, low stock, or scheduled repair logs.
  - `warning-100` (#FEF9ED) | `warning-200` (#FCF1D7) | `warning-300` (#FAE6B8) | `warning-400` (#F8D791) | `warning-500` (#F5C660) | `warning-600` (#FFB126) | `warning-700` (#C58A0D)
- **Info (Base: #009BF4)**: Neutral notifications, informational popups, and updates.
  - `info-100` (#E9F7FF) | `info-200` (#CEEDFF) | `info-300` (#A9DFFF) | `info-400` (#78CDFF) | `info-500` (#3CB7FF) | `info-600` (#009BF4) | `info-700` (#0067A3)
- **Danger (Base: #C95A5F)**: Errors, critical alerts, overdue checkouts, and destructive prompts.
  - `danger-100` (#FBF2F2) | `danger-200` (#F5E1E2) | `danger-300` (#EEC9CB) | `danger-400` (#E4ABAE) | `danger-500` (#D8888A) | `danger-600` (#C95A5F) | `danger-700` (#A9373D)

### 5.3 Buttons

Buttons follow clear hierarchical styles across all seven semantic scales:

- **Soft Pill Button**: Tinted background, fully rounded (pill) corners, no border. Used for low-emphasis triggers and filter chips.
- **Solid Pill Button**: Full-strength semantic fill, fully rounded corners, white text. Primary CTAs in compact spaces.
- **Outline Pill Button**: Transparent fill, 1px semantic border, fully rounded corners. Used for secondary actions.
- **Soft Button**: Tinted background, standard rounded-rectangle corners. Secondary actions inside cards and toolbars.
- **Solid Button**: Full-strength semantic fill, standard rounded corners. Default primary button for forms and modal actions.
- **Outline Button**: Transparent fill, semantic-colored border, standard rounded corners. Default cancellation or tertiary trigger.
- **Glass Button**: Semi-transparent surface matching status colors paired with a leading status icon.

_To satisfy accessibility guidelines, status-based actions (Success, Warning, Info, Danger) are styled with unique icons (e.g., checkmarks, exclamation triangles, etc.) so status is never conveyed by color alone._

### 5.4 Cards

Cards utilize a mathematical rounding layout logic:

- **Corner Radii**: Standardized to `8, 16, 20, 24, 30, and 36` pixels.
- **Nested Borders**: Calculate outer border curve radius as `Inner Radius + Margin`, avoiding visual misalignment.
- **Nested Thumbnails**: Calculate inner image thumbnail rounding as `Inner Radius - Margin` to ensure parallel nesting curves.

### 5.5 Icons

Line icons are loaded from the **Streamline Core** vector library, registered as Figma assets, and imported into React as SVG components to ensure sharp rendering at any scale.

### 5.6 Logo

Features a 3D-style blue cube icon paired with the wordmark **"Inventory"**:

- **Light Variant**: For clean, white backdrops.
- **Navy/Dark Variant**: Utilized in the main layout header and persistent sidebars.
- **Favicon**: A graduation-cap logo variant serving as a compact application shortcut indicator.

### 5.7 Design Process & Principles

- **Tokens over One-offs**: Hardcoded colors, borders, and margins are banned. All styles are derived from Section 5 tokens.
- **The "Split" Shell Layout**: Every internal page embeds its content area inside a shared "Wireframe Split" navigation frame (sidebar navigation on the left, primary content grid on the right).
- **Consistent Multi-State Mockups**: Features presenting complex data (e.g., Borrow Requests or History Logs) are designed concurrently in three views—**List**, **Card**, and **Modal**—preventing visual divergence.

---

## 6. User Roles & Permissions Matrix

The backend enforces Role-Based Access Control (RBAC) on the server. The client mirrors this to dynamically show or hide navigation routes and action triggers.

| Feature / Action                  | Admin | Manager | Staff | Primary File Reference                                                                                                               |
| :-------------------------------- | :---: | :-----: | :---: | :----------------------------------------------------------------------------------------------------------------------------------- |
| **View Dashboard & KPIs**         |  Yes  |   Yes   |  Yes  | [DashboardPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/DashboardPage.tsx)                   |
| **Request Equipment Borrowing**   |  Yes  |   Yes   |  Yes  | [BorrowHistoryPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/BorrowHistoryPage.tsx)           |
| **Review & Approve Borrowing**    |  Yes  |   Yes   |  No   | [BorrowRequestPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/BorrowRequestPage.tsx)           |
| **Trigger Overdue Status Checks** |  Yes  |   Yes   |  No   | [BorrowRequestPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/BorrowRequestPage.tsx)           |
| **Manage Categories & Suppliers** |  Yes  |   Yes   |  No   | [CategoryManagementPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/CategoryManagementPage.tsx) |
| **Log & Process Purchase Orders** |  Yes  |   Yes   |  No   | [PurchaseOrderPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/PurchaseOrderPage.tsx)           |
| **Manage Equipment Maintenance**  |  Yes  |   Yes   |  No   | [MaintenancePage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/MaintenancePage.tsx)               |
| **Approve Equipment Disposals**   |  Yes  |   No    |  No   | [EquipmentPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/EquipmentPage.tsx)                   |
| **View System Audit Logs**        |  Yes  |   No    |  No   | [AuditLogsPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/AuditLogsPage.tsx)                   |
| **User Account Administration**   |  Yes  |   No    |  No   | [UserManagementPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/UserManagementPage.tsx)         |

---

## 7. System Workflows & Lifecycle Operators

### 7.1 Getting Started & Authentication

The system uses a secure two-token JWT authentication strategy:

- **Access Token**: Stored in React application memory (managed by Zustand) with a short (15-minute) expiration limit.
- **Refresh Token**: Kept in an HTTP-only cookie (`jit_refresh_token`) to guard against cross-site scripting (XSS) attacks. Under production configurations (`COOKIE_SECURE=true`), browsers require HTTPS to transmit the cookie.

### 7.2 Dashboard & Alerts Quick Guide

The main landing page ([DashboardPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/DashboardPage.tsx)) lists key performance indicators alongside system alerts:

- **KPI Cards**: Aggregates counts for Total Assets, Available Equipment, Low-Stock items, and Overdue Borrows.
- **Low Stock Alerts**: Identifies consumables whose quantity has dropped to or below their designated reorder point.
- **Overdue Equipment Alerts**: Displays warning boxes detailing unreturned physical assets, the name of the borrower, and the duration of delay.

### 7.3 Inventory & Category Management

Items must belong to a pre-defined Category which dictates their profile classification type:

1.  **EQUIPMENT**: Serialized hardware records. Creating a category of type `EQUIPMENT` prompts users to fill out brand, model, condition, location, and serial number inputs in [EquipmentPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/EquipmentPage.tsx).
2.  **CONSUMABLE**: Bulk items tracked by quantity. Manually adding stock registers a ledger record in `stock_movements`.
3.  **DIGITAL_ASSET**: Software licenses, digital subscription keys, and domains.

### 7.4 Equipment Borrowing Lifecycle

Borrowing is managed through a strict request-review-return flow:

```mermaid
graph TD
    A[Staff requests item in BorrowHistoryPage] --> B(Status: PENDING)
    B --> C{Manager/Admin action in BorrowRequestPage}
    C -->|Approve| D(Status: APPROVED / BORROWED)
    C -->|Reject| E(Status: REJECTED)
    D --> F{Is due date exceeded?}
    F -->|Yes| G[Status: OVERDUE - Alarm on Dashboard]
    F -->|No / Return Triggered| H[Staff returns item]
    G --> H
    H --> I[Manager processes return & assesses condition]
    I --> J(Status: RETURNED - Equipment Available)
```

1.  **Request Submission**: Staff navigate to `My Borrow History` ([BorrowHistoryPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/BorrowHistoryPage.tsx)) and request an available physical asset. The record starts as `PENDING`.
2.  **Manager Approval**: Managers approve the checkout in [BorrowRequestPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/BorrowRequestPage.tsx), which atomically locks the asset status to `BORROWED`. If another borrow request is pending for the same asset, the system automatically rejects it.
3.  **Asset Returns**: On physical return, the Manager logs the return condition (Good, Fair, Poor). The asset's availability is atomically reset to `AVAILABLE`.
4.  **Overdue Checks**: The system periodically scans return dates. Admins can manually trigger a scan by clicking **Run Overdue Check** on the borrow request page, pushing overdue logs directly to dashboard notifications.

### 7.5 Equipment Maintenance & Repairs

Damaged assets, or those requiring routine updates, must be routed through the maintenance module ([MaintenancePage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/MaintenancePage.tsx)):

1.  Log a maintenance record for any asset currently not checked out. The equipment status transitions to `UNDER_MAINTENANCE` and locks access.
2.  Once service completes, update the status to `COMPLETED` and assign the new condition rating (Good, Fair, Poor). The item immediately changes to `AVAILABLE`.

### 7.6 Equipment Disposal

Obsolete, lost, or unrepairable equipment is decommissioned in [EquipmentPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/EquipmentPage.tsx):

1.  Select **Dispose Asset** and provide purchase history, reasons (`DAMAGED`, `OBSOLETE`, `SOLD`), and disposal notes.
2.  Disposals remain `PENDING` until an **Admin** reviews and approves the request. Once approved, the record is soft-deleted from listings but preserved in historical logs.

### 7.7 Procurement & Purchase Orders (PO)

1.  **Suppliers**: Manage supplier contacts and locations in [SupplierManagementPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/SupplierManagementPage.tsx).
2.  **Purchase Order Creation**: Build POs in [PurchaseOrderPage.tsx](file:///c:/Users/Admin/Desktop/jit-inventory-system/apps/frontend/src/pages/PurchaseOrderPage.tsx), listing quantities, costs, and tax attachments.
3.  **Lifecycle Progression**: PO statuses transition as follows:
    - `DRAFT` -> `PENDING_APPROVAL` -> `APPROVED` -> `ORDERED` -> `RECEIVED`
4.  **Auto Intake**: Receiving a PO automatically prompts users to ingest inventory:
    - **Consumables**: Stock quantities increment atomically.
    - **Equipment**: Spawns inputs to record serial numbers and system-generated Asset IDs.

### 7.8 Reports & System Audit Trail

- **Exporting Reports**: Generates detailed Excel (`.xlsx`) or PDF lists for active catalog holdings or stock movements.
- **Audit Logging**: The system records all write mutations to the database. Admins can review a read-only log feed listing the performer, date, action type, and JSON values comparing the "before" and "after" state of the modified row.

---

## 8. Troubleshooting & FAQ

#### Q: Why do users get immediately logged out when accessing the system on the network?

**A**: Ensure `COOKIE_SECURE` is configured correctly. If you serve the application over plain HTTP (Port 80) without SSL, set `COOKIE_SECURE=false` in the `.env` file. Modern browsers reject secure cookies served over unsecured connections.

#### Q: How are "Low Stock Alerts" triggered?

**A**: Consumables have a defined **Reorder Point**. When quantity drops to or below this point, a warning is raised in the notifications dropdown and on the dashboard.

#### Q: What is an Asset ID vs a Serial Number?

**A**:

- **Asset ID** is a unique, human-readable identifier generated by the system (e.g., `JIT-EQ-0105`) for internal tracking and barcoding.
- **Serial Number** is the manufacturer's serial code stamped on the hardware (e.g., `S/N: 82FX291X04`).
