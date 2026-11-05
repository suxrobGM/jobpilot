-- CreateEnum
CREATE TYPE "pilot_message_author" AS ENUM ('user', 'pilot');

-- CreateEnum
CREATE TYPE "pilot_request_status" AS ENUM ('pending', 'running', 'done', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "pilot_request_source" AS ENUM ('web', 'chat', 'notice');

-- AlterEnum
ALTER TYPE "pilot_subject_type" ADD VALUE 'chat';
ALTER TYPE "pilot_subject_type" ADD VALUE 'resume';
ALTER TYPE "pilot_subject_type" ADD VALUE 'request';

-- The pilot now runs whenever the agent is paired; the old switch only gates autonomous work.
ALTER TABLE "pilot_states" RENAME COLUMN "running" TO "autopilot";

-- Task payload shapes changed; a cached list would not parse.
UPDATE "pilot_states" SET "task_list_version" = NULL, "task_list_expires_at" = NULL, "task_list_snapshot" = NULL;

-- CreateTable
CREATE TABLE "pilot_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "author" "pilot_message_author" NOT NULL,
    "body" TEXT NOT NULL,
    "run_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilot_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "subject_type" "pilot_subject_type" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "status" "pilot_request_status" NOT NULL DEFAULT 'pending',
    "source" "pilot_request_source" NOT NULL,
    "run_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "pilot_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pilot_messages_user_id_created_at_idx" ON "pilot_messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "pilot_messages_run_id_idx" ON "pilot_messages"("run_id");

-- CreateIndex
CREATE INDEX "pilot_requests_user_id_status_created_at_idx" ON "pilot_requests"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "pilot_requests_user_id_created_at_idx" ON "pilot_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "pilot_requests_run_id_idx" ON "pilot_requests"("run_id");

-- AddForeignKey
ALTER TABLE "pilot_messages" ADD CONSTRAINT "pilot_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilot_messages" ADD CONSTRAINT "pilot_messages_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pilot_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilot_requests" ADD CONSTRAINT "pilot_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilot_requests" ADD CONSTRAINT "pilot_requests_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pilot_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

