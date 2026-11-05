-- `jobs` was ambiguous next to `job_listings`; these rows are a campaign's jobs.
ALTER TABLE "jobs" RENAME TO "campaign_jobs";
ALTER TABLE "campaign_jobs" RENAME CONSTRAINT "jobs_pkey" TO "campaign_jobs_pkey";
ALTER TABLE "campaign_jobs" RENAME CONSTRAINT "jobs_board_id_fkey" TO "campaign_jobs_board_id_fkey";
ALTER TABLE "campaign_jobs" RENAME CONSTRAINT "jobs_campaign_id_fkey" TO "campaign_jobs_campaign_id_fkey";
ALTER INDEX "jobs_board_id_idx" RENAME TO "campaign_jobs_board_id_idx";
ALTER INDEX "jobs_campaign_id_key_key" RENAME TO "campaign_jobs_campaign_id_key_key";
ALTER INDEX "jobs_campaign_id_status_idx" RENAME TO "campaign_jobs_campaign_id_status_idx";
ALTER INDEX "jobs_status_updated_at_idx" RENAME TO "campaign_jobs_status_updated_at_idx";

-- user_id copied from the campaign, so per-user reads skip the campaigns join.
ALTER TABLE "campaign_jobs" ADD COLUMN "user_id" TEXT;
UPDATE "campaign_jobs" j SET "user_id" = c."user_id" FROM "campaigns" c WHERE c."id" = j."campaign_id";
ALTER TABLE "campaign_jobs" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "campaign_jobs" ADD CONSTRAINT "campaign_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "jobs_campaign_id_updated_at_idx";
CREATE INDEX "campaign_jobs_user_id_updated_at_idx" ON "campaign_jobs"("user_id", "updated_at");
CREATE INDEX "campaign_jobs_user_id_status_updated_at_idx" ON "campaign_jobs"("user_id", "status", "updated_at");
