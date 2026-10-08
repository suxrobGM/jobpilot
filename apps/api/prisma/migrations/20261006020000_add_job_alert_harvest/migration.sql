-- IF NOT EXISTS: databases that ran the fork's pre-v2 job-alert migration already have these columns.
-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN IF NOT EXISTS "harvested_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "links" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "pilot_states" ADD COLUMN IF NOT EXISTS "job_alerts_requested_at" TIMESTAMP(3);
