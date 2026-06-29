-- CreateEnum
CREATE TYPE "DisposalApprovalStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- AlterTable
ALTER TABLE "disposals" ADD COLUMN     "approval_status" "DisposalApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "disposals_approval_status_idx" ON "disposals"("approval_status");

-- CreateIndex
CREATE INDEX "disposals_disposal_date_idx" ON "disposals"("disposal_date");
