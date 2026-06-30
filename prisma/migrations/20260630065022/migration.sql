/*
  Warnings:

  - The values [OVERDUE_EQUIPMENT] on the enum `AlertType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `borrow_record_id` on the `inventory_alerts` table. All the data in the column will be lost.
  - Made the column `consumable_profile_id` on table `inventory_alerts` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AlertType_new" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK');
ALTER TABLE "inventory_alerts" ALTER COLUMN "alert_type" TYPE "AlertType_new" USING ("alert_type"::text::"AlertType_new");
ALTER TYPE "AlertType" RENAME TO "AlertType_old";
ALTER TYPE "AlertType_new" RENAME TO "AlertType";
DROP TYPE "public"."AlertType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "inventory_alerts" DROP CONSTRAINT "inventory_alerts_borrow_record_id_fkey";

-- DropIndex
DROP INDEX "inventory_alerts_borrow_record_id_idx";

-- AlterTable
ALTER TABLE "inventory_alerts" DROP COLUMN "borrow_record_id",
ALTER COLUMN "consumable_profile_id" SET NOT NULL;
