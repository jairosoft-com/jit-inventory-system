-- AlterTable
ALTER TABLE "maintenance_logs" ADD COLUMN     "equipment_brand" VARCHAR(255),
ADD COLUMN     "equipment_condition" "ConditionStatus",
ADD COLUMN     "equipment_model" VARCHAR(255),
ADD COLUMN     "equipment_name" VARCHAR(255);
