/*
  Warnings:

  - The values [INFO] on the enum `AlertPriority` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AlertPriority_new" AS ENUM ('WARNING', 'CRITICAL');
ALTER TABLE "public"."inventory_alerts" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "inventory_alerts" ALTER COLUMN "priority" TYPE "AlertPriority_new" USING ("priority"::text::"AlertPriority_new");
ALTER TYPE "AlertPriority" RENAME TO "AlertPriority_old";
ALTER TYPE "AlertPriority_new" RENAME TO "AlertPriority";
DROP TYPE "public"."AlertPriority_old";
COMMIT;

-- DropIndex
DROP INDEX "inventory_alerts_alert_type_idx";

-- DropIndex
DROP INDEX "inventory_alerts_created_at_idx";

-- AlterTable
ALTER TABLE "inventory_alerts" ALTER COLUMN "priority" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "inventory_alerts_resolved_at_idx" ON "inventory_alerts"("resolved_at");
