-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "harvested_at" TIMESTAMP(3),
ADD COLUMN     "links" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "pilot_states" ADD COLUMN     "job_alerts_requested_at" TIMESTAMP(3);
