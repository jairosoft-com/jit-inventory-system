-- Enforce at most one active (SCHEDULED or IN_PROGRESS) maintenance log per equipment
CREATE UNIQUE INDEX "unique_active_maintenance_per_equipment"
  ON "maintenance_logs" ("equipment_id")
  WHERE "status" IN ('SCHEDULED', 'IN_PROGRESS');