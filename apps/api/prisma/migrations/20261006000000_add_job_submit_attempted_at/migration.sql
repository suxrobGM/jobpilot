-- AlterTable
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "submit_attempted_at" TIMESTAMP(3);
