-- AlterTable
ALTER TABLE "inventory_alerts" ADD COLUMN     "user_id" INTEGER;

-- CreateIndex
CREATE INDEX "inventory_alerts_user_id_idx" ON "inventory_alerts"("user_id");

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
