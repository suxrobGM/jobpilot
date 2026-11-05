-- CreateEnum
CREATE TYPE "pilot_change_source" AS ENUM ('user', 'chat', 'pilot', 'notice');

-- CreateEnum
CREATE TYPE "pilot_change_status" AS ENUM ('proposed', 'applied', 'undone', 'dismissed');

-- A search's name starts as its query; the pilot writes plain names from here on.
ALTER TABLE "pilot_searches" ADD COLUMN "name" TEXT;
UPDATE "pilot_searches" SET "name" = "query";
ALTER TABLE "pilot_searches" ALTER COLUMN "name" SET NOT NULL;

-- CreateTable
CREATE TABLE "pilot_changes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" "pilot_change_source" NOT NULL,
    "status" "pilot_change_status" NOT NULL,
    "summary" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "undo" JSONB,
    "run_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "pilot_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pilot_changes_user_id_status_created_at_idx" ON "pilot_changes"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "pilot_changes_user_id_created_at_idx" ON "pilot_changes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "pilot_changes_run_id_idx" ON "pilot_changes"("run_id");

-- AddForeignKey
ALTER TABLE "pilot_changes" ADD CONSTRAINT "pilot_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilot_changes" ADD CONSTRAINT "pilot_changes_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pilot_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
