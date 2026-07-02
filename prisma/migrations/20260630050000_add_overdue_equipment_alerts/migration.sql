-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'OVERDUE_EQUIPMENT';

-- AlterTable
-- consumable_profile_id is no longer required: equipment-overdue alerts
-- link to a borrow_record instead of a consumable_profile.
ALTER TABLE "inventory_alerts" ALTER COLUMN "consumable_profile_id" DROP NOT NULL;
ALTER TABLE "inventory_alerts" ADD COLUMN "borrow_record_id" INTEGER;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_borrow_record_id_fkey"
  FOREIGN KEY ("borrow_record_id") REFERENCES "borrow_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "inventory_alerts_borrow_record_id_idx" ON "inventory_alerts"("borrow_record_id");
