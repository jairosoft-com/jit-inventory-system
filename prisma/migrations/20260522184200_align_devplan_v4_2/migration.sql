-- AlterEnum
BEGIN;
CREATE TYPE "DigitalAssetType_new" AS ENUM ('SOFTWARE', 'SUBSCRIPTION', 'DOMAIN', 'LICENSE', 'API_KEY');
ALTER TABLE "digital_assets" ALTER COLUMN "asset_type" TYPE "DigitalAssetType_new" USING ("asset_type"::text::"DigitalAssetType_new");
ALTER TYPE "DigitalAssetType" RENAME TO "DigitalAssetType_old";
ALTER TYPE "DigitalAssetType_new" RENAME TO "DigitalAssetType";
DROP TYPE "public"."DigitalAssetType_old";
COMMIT;

-- AlterTable
ALTER TABLE "digital_assets" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "renewal_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "disposals" DROP COLUMN "condition",
DROP COLUMN "replacement_needed",
ADD COLUMN     "method" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inventory_logs" DROP COLUMN "changes",
DROP COLUMN "ip_address",
ADD COLUMN     "new_data" JSONB,
ADD COLUMN     "old_data" JSONB;
