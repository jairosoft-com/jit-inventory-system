-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'WARRANTY_EXPIRING';
ALTER TYPE "AlertType" ADD VALUE 'REPLACEMENT_NEEDED';

-- DropForeignKey
ALTER TABLE "inventory_alerts" DROP CONSTRAINT "inventory_alerts_consumable_profile_id_fkey";

-- AlterTable
ALTER TABLE "inventory_alerts" ADD COLUMN     "equipment_id" INTEGER,
ALTER COLUMN "consumable_profile_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "inventory_alerts_equipment_id_idx" ON "inventory_alerts"("equipment_id");

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_consumable_profile_id_fkey" FOREIGN KEY ("consumable_profile_id") REFERENCES "consumable_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
