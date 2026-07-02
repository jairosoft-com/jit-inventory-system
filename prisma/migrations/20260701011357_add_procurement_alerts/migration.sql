-- CreateEnum
CREATE TYPE "ProcurementAlertType" AS ENUM ('PENDING_APPROVAL', 'STATUS_UPDATED');

-- CreateTable
CREATE TABLE "procurement_alerts" (
    "id" SERIAL NOT NULL,
    "purchase_order_id" INTEGER NOT NULL,
    "alert_type" "ProcurementAlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procurement_alerts_is_read_idx" ON "procurement_alerts"("is_read");

-- CreateIndex
CREATE INDEX "procurement_alerts_purchase_order_id_idx" ON "procurement_alerts"("purchase_order_id");

-- CreateIndex
CREATE INDEX "procurement_alerts_alert_type_idx" ON "procurement_alerts"("alert_type");

-- AddForeignKey
ALTER TABLE "procurement_alerts" ADD CONSTRAINT "procurement_alerts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
