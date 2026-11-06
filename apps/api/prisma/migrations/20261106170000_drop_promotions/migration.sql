-- Promotion posts are gone: their table, status enum, subject type, tasks and settings.
DELETE FROM "pilot_journal_entries"
WHERE "subject_type" = 'promotion'
   OR "run_id" IN (SELECT "id" FROM "pilot_runs" WHERE "task_type" LIKE 'promotion.%');
DELETE FROM "pilot_questions" WHERE "subject_type" = 'promotion';
DELETE FROM "pilot_requests" WHERE "subject_type" = 'promotion' OR "task_type" LIKE 'promotion.%';
DELETE FROM "pilot_runs" WHERE "subject_type" = 'promotion' OR "task_type" LIKE 'promotion.%';

UPDATE "pilot_journal_entries" SET "detail" = "detail" - 'promotionsPosted'
WHERE "kind" = 'digest' AND "detail" ? 'promotionsPosted';

-- The snapshot holds promotion tasks the new schema no longer parses.
UPDATE "pilot_states" SET "config" = "config" - 'promotion',
  "task_list_snapshot" = NULL, "task_list_version" = NULL, "task_list_expires_at" = NULL;

DROP TABLE "promotion_posts";
DROP TYPE "promotion_status";

ALTER TYPE "pilot_subject_type" RENAME TO "pilot_subject_type_old";
CREATE TYPE "pilot_subject_type" AS ENUM ('job', 'feed', 'question', 'networking', 'inbox', 'application', 'email', 'board', 'pilot', 'upwork', 'chat', 'resume', 'request');
ALTER TABLE "pilot_runs"
  ALTER COLUMN "subject_type" TYPE "pilot_subject_type" USING "subject_type"::text::"pilot_subject_type";
ALTER TABLE "pilot_questions"
  ALTER COLUMN "subject_type" TYPE "pilot_subject_type" USING "subject_type"::text::"pilot_subject_type";
ALTER TABLE "pilot_journal_entries"
  ALTER COLUMN "subject_type" TYPE "pilot_subject_type" USING "subject_type"::text::"pilot_subject_type";
ALTER TABLE "pilot_requests"
  ALTER COLUMN "subject_type" TYPE "pilot_subject_type" USING "subject_type"::text::"pilot_subject_type";
DROP TYPE "pilot_subject_type_old";
