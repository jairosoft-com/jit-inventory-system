-- CreateEnum
CREATE TYPE "AlertPriority" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK');

-- CreateTable
CREATE TABLE "inventory_alerts" (
    "id"                    SERIAL NOT NULL,
    "alert_type"            "AlertType" NOT NULL,
    "priority"              "AlertPriority" NOT NULL DEFAULT 'WARNING',
    "consumable_profile_id" INTEGER NOT NULL,
    "message"               TEXT NOT NULL,
    "is_read"               BOOLEAN NOT NULL DEFAULT false,
    "read_at"               TIMESTAMP(3),
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at"           TIMESTAMP(3),

    CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_alerts_consumable_profile_id_idx" ON "inventory_alerts"("consumable_profile_id");

-- CreateIndex
CREATE INDEX "inventory_alerts_is_read_idx" ON "inventory_alerts"("is_read");

-- CreateIndex
CREATE INDEX "inventory_alerts_alert_type_idx" ON "inventory_alerts"("alert_type");

-- CreateIndex
CREATE INDEX "inventory_alerts_created_at_idx" ON "inventory_alerts"("created_at");

-- AddForeignKey
ALTER TABLE "inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_consumable_profile_id_fkey"
    FOREIGN KEY ("consumable_profile_id")
    REFERENCES "consumable_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;