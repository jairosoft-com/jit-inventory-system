-- AlterTable
ALTER TABLE "equipment_images" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "url" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "item_images" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "label" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "item_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_images_item_id_idx" ON "item_images"("item_id");

-- CreateIndex
CREATE INDEX "equipment_deleted_at_idx" ON "equipment"("deleted_at");

-- CreateIndex
CREATE INDEX "equipment_images_deleted_at_idx" ON "equipment_images"("deleted_at");

-- AddForeignKey
ALTER TABLE "item_images" ADD CONSTRAINT "item_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
