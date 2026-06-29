-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "replacement_needed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replacement_needed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "equipment_replacement_needed_idx" ON "equipment"("replacement_needed");
