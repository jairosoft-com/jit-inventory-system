-- Step 1: Update the PurchaseOrderStatus enum
-- Alter the enum type: add new values first
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

COMMIT;

-- First, update any existing 'RECEIVED' values to 'COMPLETED'
UPDATE "purchase_orders" SET "status" = 'COMPLETED' WHERE "status" = 'RECEIVED';

-- Note: PostgreSQL does not support removing enum values directly.
-- The 'RECEIVED' value will remain in the enum type but will not be used.
-- This is a safe approach that avoids complex enum migration workarounds.

-- Step 2: Create the purchase_order_history table
CREATE TABLE "purchase_order_history" (
    "id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "old_status" "PurchaseOrderStatus" NOT NULL,
    "new_status" "PurchaseOrderStatus" NOT NULL,
    "changed_by_id" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_history_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create the purchase_order_attachments table
CREATE TABLE "purchase_order_attachments" (
    "id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_attachments_pkey" PRIMARY KEY ("id")
);

-- Step 4: Add indexes
CREATE INDEX "purchase_order_history_purchase_order_id_idx" ON "purchase_order_history"("purchase_order_id");
CREATE INDEX "purchase_order_history_created_at_idx" ON "purchase_order_history"("created_at");
CREATE INDEX "purchase_order_attachments_purchase_order_id_idx" ON "purchase_order_attachments"("purchase_order_id");

-- Step 5: Add foreign key constraints
ALTER TABLE "purchase_order_history" ADD CONSTRAINT "purchase_order_history_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_history" ADD CONSTRAINT "purchase_order_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order_attachments" ADD CONSTRAINT "purchase_order_attachments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
