/*
  Warnings:

  - Added the required column `user_id` to the `procurement_alerts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LogAction" ADD VALUE 'LOGIN';
ALTER TYPE "LogAction" ADD VALUE 'LOGOUT';

-- AlterTable
ALTER TABLE "procurement_alerts" ADD COLUMN     "user_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "procurement_alerts_user_id_idx" ON "procurement_alerts"("user_id");

-- AddForeignKey
ALTER TABLE "procurement_alerts" ADD CONSTRAINT "procurement_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
