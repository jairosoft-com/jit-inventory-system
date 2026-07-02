-- CreateTable
CREATE TABLE "maintenance_alerts" (
    "id" SERIAL NOT NULL,
    "maintenance_log_id" INTEGER NOT NULL,
    "alert_type" VARCHAR(50) NOT NULL DEFAULT 'MAINTENANCE_DUE',
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_alerts_maintenance_log_id_idx" ON "maintenance_alerts"("maintenance_log_id");

-- CreateIndex
CREATE INDEX "maintenance_alerts_is_read_idx" ON "maintenance_alerts"("is_read");

-- AddForeignKey
ALTER TABLE "maintenance_alerts" ADD CONSTRAINT "maintenance_alerts_maintenance_log_id_fkey" FOREIGN KEY ("maintenance_log_id") REFERENCES "maintenance_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
