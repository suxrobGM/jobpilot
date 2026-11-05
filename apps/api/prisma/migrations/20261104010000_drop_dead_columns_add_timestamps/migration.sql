-- Never written (failReason) or never shown (rejectedAt; the status_change event records it).
ALTER TABLE "applications" DROP COLUMN "fail_reason", DROP COLUMN "rejected_at";

-- Always equal to first_seen_at.
ALTER TABLE "job_listings" DROP COLUMN "created_at";

-- Prisma sets updated_at on write; the DB default only matters for this backfill.
ALTER TABLE "credentials" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "credentials" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "auto_apply_settings" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "auto_apply_settings" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "upwork_profiles" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "upwork_profiles" SET "created_at" = "updated_at";
ALTER TABLE "upwork_accounts" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "upwork_accounts" SET "created_at" = "updated_at";
ALTER TABLE "cover_letters" ADD COLUMN "updated_at" TIMESTAMP(3);
UPDATE "cover_letters" SET "updated_at" = "created_at";
ALTER TABLE "cover_letters" ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "jobs" ALTER COLUMN "updated_at" DROP DEFAULT;
