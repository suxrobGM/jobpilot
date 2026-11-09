-- A run's result line moves onto the run; the journal table goes. Digests, host status lines,
-- corrections and run-less entries from old skills are not carried over.
ALTER TABLE "pilot_runs" ADD COLUMN "summary" TEXT;

UPDATE "pilot_runs" AS r
SET "summary" = e."summary"
FROM (
  SELECT DISTINCT ON ("run_id") "run_id", "summary"
  FROM "pilot_journal_entries"
  WHERE "run_id" IS NOT NULL AND "kind" = 'action'
  ORDER BY "run_id", "created_at" DESC, "id" DESC
) AS e
WHERE e."run_id" = r."id";

DROP TABLE "pilot_journal_entries";
DROP TYPE "pilot_journal_kind";

CREATE INDEX "pilot_runs_user_id_finished_at_idx" ON "pilot_runs"("user_id", "finished_at");

-- Autopilot is on exactly while autopilot_since is set.
UPDATE "pilot_states" SET "autopilot_since" = COALESCE("autopilot_since", now()) WHERE "autopilot";
UPDATE "pilot_states" SET "autopilot_since" = NULL WHERE NOT "autopilot";
ALTER TABLE "pilot_states" DROP COLUMN "autopilot";

-- The snapshot carries its own expiry; the version token is gone, so every live list is dropped.
ALTER TABLE "pilot_states" DROP COLUMN "task_list_version";
ALTER TABLE "pilot_states" DROP COLUMN "task_list_expires_at";
ALTER TABLE "pilot_states" DROP COLUMN "task_list_snapshot";
ALTER TABLE "pilot_states" ADD COLUMN "task_list" JSONB;

-- Counts as today's digest, so the switch never sends a second one the same day.
ALTER TABLE "pilot_states" ADD COLUMN "digest_at" TIMESTAMPTZ(3);
UPDATE "pilot_states" SET "digest_at" = now();
