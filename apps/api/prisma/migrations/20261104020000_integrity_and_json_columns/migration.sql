-- Subject types become an enum. Fail loudly on a value outside the set instead of guessing.
CREATE TYPE "pilot_subject_type" AS ENUM ('job', 'campaign', 'question', 'networking', 'inbox', 'promotion', 'application', 'email', 'board', 'pilot', 'upwork');

DO $$
DECLARE
  allowed TEXT[] := enum_range(NULL::"pilot_subject_type")::TEXT[];
  bad TEXT;
BEGIN
  SELECT string_agg(DISTINCT subject_type, ', ') INTO bad FROM (
    SELECT subject_type FROM "pilot_runs"
    UNION ALL SELECT subject_type FROM "pilot_questions" WHERE subject_type IS NOT NULL
    UNION ALL SELECT subject_type FROM "pilot_journal_entries" WHERE subject_type IS NOT NULL
  ) s WHERE subject_type <> ALL (allowed);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown pilot subject types: %', bad;
  END IF;
END $$;

ALTER TABLE "pilot_runs" ALTER COLUMN "subject_type" TYPE "pilot_subject_type" USING "subject_type"::"pilot_subject_type";
ALTER TABLE "pilot_questions" ALTER COLUMN "subject_type" TYPE "pilot_subject_type" USING "subject_type"::"pilot_subject_type";
ALTER TABLE "pilot_journal_entries" ALTER COLUMN "subject_type" TYPE "pilot_subject_type" USING "subject_type"::"pilot_subject_type";

-- PilotSearch.resumeId becomes a real FK; ids of deleted resumes clear.
UPDATE "pilot_searches" SET "resume_id" = NULL
WHERE "resume_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "resumes" r WHERE r."id" = "pilot_searches"."resume_id");
CREATE INDEX "pilot_searches_resume_id_idx" ON "pilot_searches"("resume_id");
ALTER TABLE "pilot_searches" ADD CONSTRAINT "pilot_searches_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Journal cycle_id always held a run id; name it so and enforce it.
ALTER TABLE "pilot_journal_entries" RENAME COLUMN "cycle_id" TO "run_id";
UPDATE "pilot_journal_entries" SET "run_id" = NULL
WHERE "run_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "pilot_runs" r WHERE r."id" = "pilot_journal_entries"."run_id");
CREATE INDEX "pilot_journal_entries_run_id_idx" ON "pilot_journal_entries"("run_id");
ALTER TABLE "pilot_journal_entries" ADD CONSTRAINT "pilot_journal_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "pilot_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Upwork drafts link the campaign job they came from by FK, not by a loose (campaign_id, job_key) pair.
ALTER TABLE "upwork_proposals" ADD COLUMN "job_id" TEXT;
UPDATE "upwork_proposals" p SET "job_id" = j."id"
FROM "jobs" j WHERE j."campaign_id" = p."campaign_id" AND j."key" = p."job_key";
DROP INDEX "upwork_proposals_campaign_id_idx";
ALTER TABLE "upwork_proposals" DROP COLUMN "campaign_id", DROP COLUMN "job_key";
CREATE INDEX "upwork_proposals_job_id_idx" ON "upwork_proposals"("job_id");
ALTER TABLE "upwork_proposals" ADD CONSTRAINT "upwork_proposals_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- JSON stored as text becomes jsonb. A row that does not parse aborts the migration.
ALTER TABLE "upwork_inbox_items" RENAME COLUMN "raw" TO "payload";
ALTER TABLE "upwork_inbox_items" ALTER COLUMN "payload" DROP DEFAULT;
ALTER TABLE "upwork_inbox_items" ALTER COLUMN "payload" TYPE JSONB USING "payload"::jsonb;
ALTER TABLE "upwork_inbox_items" ALTER COLUMN "payload" SET DEFAULT '{}';

UPDATE "jobs" SET "brief" = NULL WHERE btrim("brief") = '';
ALTER TABLE "jobs" ALTER COLUMN "brief" TYPE JSONB USING "brief"::jsonb;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "jobs" WHERE "brief" IS NOT NULL AND jsonb_typeof("brief") <> 'object') THEN
    RAISE EXCEPTION 'jobs.brief holds a non-object JSON value';
  END IF;
END $$;

-- Cached task lists embed briefs as strings and ids in the old shape; drop them so the next fetch
-- rebuilds one, as TASK_LIST_SNAPSHOT_RESET does. A run started off a dropped list is refused as stale.
UPDATE "pilot_states" SET "task_list_version" = NULL, "task_list_expires_at" = NULL, "task_list_snapshot" = NULL;
