-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('EQUIPMENT', 'CONSUMABLE', 'DIGITAL');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'UNDER_MAINTENANCE', 'DAMAGED', 'LOST', 'BORROWED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DigitalStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DigitalAssetType" AS ENUM ('SOFTWARE', 'SUBSCRIPTION', 'DOMAIN', 'ACCOUNT', 'LICENSE', 'API_KEY');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "BorrowStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BORROWED', 'RETURNED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "DisposalReason" AS ENUM ('DAMAGED_BEYOND_REPAIR', 'OUTDATED', 'LOST', 'STOLEN', 'DONATED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'APPROVED', 'REJECTED', 'BORROWED', 'RETURNED', 'DISPOSED', 'TRANSFERRED', 'MAINTENANCE_STARTED', 'MAINTENANCE_COMPLETED', 'RENEWED');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "ItemType" NOT NULL,
    "description" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" INTEGER NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_point" INTEGER NOT NULL DEFAULT 0,
    "status" "ItemStatus" NOT NULL DEFAULT 'IN_STOCK',
    "barcode" VARCHAR(255),
    "image_url" VARCHAR(500),
    "registered_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "asset_id" VARCHAR(100) NOT NULL,
    "serial_number" VARCHAR(100),
    "brand" VARCHAR(255),
    "model" VARCHAR(255),
    "condition" "ConditionStatus" NOT NULL DEFAULT 'NEW',
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location" VARCHAR(255),
    "assigned_to" INTEGER,
    "acquisition_date" DATE,
    "purchase_price" DECIMAL(10,2),
    "warranty_start" DATE,
    "warranty_end" DATE,
    "warranty_provider" VARCHAR(255),
    "warranty_doc_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_assets" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "asset_type" "DigitalAssetType" NOT NULL,
    "url" VARCHAR(500),
    "vendor" VARCHAR(255),
    "license_key" TEXT,
    "credentials_ref" VARCHAR(255),
    "seats" INTEGER,
    "expiry_date" DATE,
    "cost" DECIMAL(10,2),
    "billing_cycle" "BillingCycle",
    "status" "DigitalStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "supplier_name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "invoice_number" VARCHAR(100),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(10,2) NOT NULL,
    "receipt_url" VARCHAR(500),
    "created_by_id" INTEGER NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_in" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity_added" INTEGER NOT NULL,
    "purchase_order_id" INTEGER,
    "received_by_id" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_in_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_out" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity_removed" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "released_by_id" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_out_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_records" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "borrowed_by_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "borrow_date" TIMESTAMP(3),
    "expected_return" DATE NOT NULL,
    "actual_return" TIMESTAMP(3),
    "return_condition" "ConditionStatus",
    "status" "BorrowStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrow_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_date" DATE,
    "completed_date" DATE,
    "cost" DECIMAL(10,2),
    "performed_by_id" INTEGER,
    "performed_by_vendor" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposals" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER NOT NULL,
    "disposal_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "DisposalReason" NOT NULL,
    "condition" "ConditionStatus" NOT NULL,
    "replacement_needed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" SERIAL NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "action" "LogAction" NOT NULL,
    "changes" JSONB,
    "performed_by" INTEGER NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "categories_type_idx" ON "categories"("type");

-- CreateIndex
CREATE UNIQUE INDEX "items_barcode_key" ON "items"("barcode");

-- CreateIndex
CREATE INDEX "items_category_id_idx" ON "items"("category_id");

-- CreateIndex
CREATE INDEX "items_status_idx" ON "items"("status");

-- CreateIndex
CREATE INDEX "items_deleted_at_idx" ON "items"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_item_id_key" ON "equipment"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_asset_id_key" ON "equipment"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_serial_number_key" ON "equipment"("serial_number");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_assigned_to_idx" ON "equipment"("assigned_to");

-- CreateIndex
CREATE INDEX "equipment_warranty_end_idx" ON "equipment"("warranty_end");

-- CreateIndex
CREATE UNIQUE INDEX "digital_assets_item_id_key" ON "digital_assets"("item_id");

-- CreateIndex
CREATE INDEX "digital_assets_status_idx" ON "digital_assets"("status");

-- CreateIndex
CREATE INDEX "digital_assets_expiry_date_idx" ON "digital_assets"("expiry_date");

-- CreateIndex
CREATE INDEX "digital_assets_asset_type_idx" ON "digital_assets"("asset_type");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_invoice_number_key" ON "purchase_orders"("invoice_number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_item_id_key" ON "purchase_order_items"("purchase_order_id", "item_id");

-- CreateIndex
CREATE INDEX "stock_in_item_id_idx" ON "stock_in"("item_id");

-- CreateIndex
CREATE INDEX "stock_out_item_id_idx" ON "stock_out"("item_id");

-- CreateIndex
CREATE INDEX "borrow_records_equipment_id_idx" ON "borrow_records"("equipment_id");

-- CreateIndex
CREATE INDEX "borrow_records_status_idx" ON "borrow_records"("status");

-- CreateIndex
CREATE INDEX "borrow_records_expected_return_idx" ON "borrow_records"("expected_return");

-- CreateIndex
CREATE INDEX "maintenance_logs_equipment_id_idx" ON "maintenance_logs"("equipment_id");

-- CreateIndex
CREATE INDEX "maintenance_logs_status_idx" ON "maintenance_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "disposals_equipment_id_key" ON "disposals"("equipment_id");

-- CreateIndex
CREATE INDEX "inventory_logs_entity_type_entity_id_idx" ON "inventory_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "inventory_logs_performed_by_idx" ON "inventory_logs"("performed_by");

-- CreateIndex
CREATE INDEX "inventory_logs_performed_at_idx" ON "inventory_logs"("performed_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_in" ADD CONSTRAINT "stock_in_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_in" ADD CONSTRAINT "stock_in_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_in" ADD CONSTRAINT "stock_in_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_out" ADD CONSTRAINT "stock_out_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_out" ADD CONSTRAINT "stock_out_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_records" ADD CONSTRAINT "borrow_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_records" ADD CONSTRAINT "borrow_records_borrowed_by_id_fkey" FOREIGN KEY ("borrowed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_records" ADD CONSTRAINT "borrow_records_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
