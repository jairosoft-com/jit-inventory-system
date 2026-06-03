/*
  Warnings:

  - You are about to drop the column `quantity` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `reorder_point` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `item_id` on the `stock_in` table. All the data in the column will be lost.
  - You are about to drop the column `item_id` on the `stock_out` table. All the data in the column will be lost.
  - Added the required column `item_type` to the `items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consumable_profile_id` to the `stock_in` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consumable_profile_id` to the `stock_out` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "stock_in" DROP CONSTRAINT "stock_in_item_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_out" DROP CONSTRAINT "stock_out_item_id_fkey";

-- DropIndex
DROP INDEX "items_status_idx";

-- DropIndex
DROP INDEX "stock_in_item_id_idx";

-- DropIndex
DROP INDEX "stock_out_item_id_idx";

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "purchase_order_id" INTEGER;

-- AlterTable
ALTER TABLE "items" DROP COLUMN "quantity",
DROP COLUMN "reorder_point",
DROP COLUMN "status",
DROP COLUMN "unit",
ADD COLUMN     "item_type" "ItemType" NOT NULL;

-- AlterTable
ALTER TABLE "stock_in" DROP COLUMN "item_id",
ADD COLUMN     "consumable_profile_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "stock_out" DROP COLUMN "item_id",
ADD COLUMN     "consumable_profile_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "consumable_profiles" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_point" INTEGER NOT NULL DEFAULT 0,
    "status" "ItemStatus" NOT NULL DEFAULT 'IN_STOCK',

    CONSTRAINT "consumable_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_images" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "label" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consumable_profiles_item_id_key" ON "consumable_profiles"("item_id");

-- CreateIndex
CREATE INDEX "consumable_profiles_status_idx" ON "consumable_profiles"("status");

-- CreateIndex
CREATE INDEX "equipment_images_equipment_id_idx" ON "equipment_images"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_purchase_order_id_idx" ON "equipment"("purchase_order_id");

-- CreateIndex
CREATE INDEX "items_item_type_idx" ON "items"("item_type");

-- CreateIndex
CREATE INDEX "stock_in_consumable_profile_id_idx" ON "stock_in"("consumable_profile_id");

-- CreateIndex
CREATE INDEX "stock_out_consumable_profile_id_idx" ON "stock_out"("consumable_profile_id");

-- AddForeignKey
ALTER TABLE "consumable_profiles" ADD CONSTRAINT "consumable_profiles_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_images" ADD CONSTRAINT "equipment_images_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_in" ADD CONSTRAINT "stock_in_consumable_profile_id_fkey" FOREIGN KEY ("consumable_profile_id") REFERENCES "consumable_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_out" ADD CONSTRAINT "stock_out_consumable_profile_id_fkey" FOREIGN KEY ("consumable_profile_id") REFERENCES "consumable_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
