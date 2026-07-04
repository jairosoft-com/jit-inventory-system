/*
  Warnings:

  - The values [LOGIN,LOGOUT] on the enum `LogAction` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `alert_type` on the `maintenance_alerts` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LogAction_new" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'APPROVED', 'REJECTED', 'BORROWED', 'RETURNED', 'DISPOSED', 'TRANSFERRED', 'MAINTENANCE_STARTED', 'MAINTENANCE_COMPLETED', 'RENEWED');
ALTER TABLE "inventory_logs" ALTER COLUMN "action" TYPE "LogAction_new" USING ("action"::text::"LogAction_new");
ALTER TYPE "LogAction" RENAME TO "LogAction_old";
ALTER TYPE "LogAction_new" RENAME TO "LogAction";
DROP TYPE "public"."LogAction_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "maintenance_alerts" DROP CONSTRAINT "maintenance_alerts_maintenance_log_id_fkey";

-- AlterTable
ALTER TABLE "maintenance_alerts" DROP COLUMN "alert_type";

-- CreateIndex
CREATE INDEX "maintenance_alerts_created_at_idx" ON "maintenance_alerts"("created_at");

-- AddForeignKey
ALTER TABLE "maintenance_alerts" ADD CONSTRAINT "maintenance_alerts_maintenance_log_id_fkey" FOREIGN KEY ("maintenance_log_id") REFERENCES "maintenance_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
