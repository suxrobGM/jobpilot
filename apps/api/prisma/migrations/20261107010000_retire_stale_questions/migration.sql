-- Answers no run consumed predate feeds; a host with no Start/Stop would replay campaign-era decisions.
-- Mirrors withoutConsumingRuns: a crashed (expired/cancelled) run does not count as consuming.
UPDATE "pilot_questions" q
SET "status" = 'cancelled'
WHERE q."status" = 'answered'
  AND NOT EXISTS (
    SELECT 1 FROM "pilot_runs" r
    WHERE r."user_id" = q."user_id"
      AND r."task_type" = 'question.answered'
      AND r."subject_id" = q."id"::text
      AND (r."finished_at" IS NULL OR r."outcome" NOT IN ('expired', 'cancelled'))
  );

-- Open campaign questions offer options ("Complete campaign") no task can act on anymore.
UPDATE "pilot_questions"
SET "status" = 'cancelled'
WHERE "status" = 'open' AND "prompt" ILIKE '%campaign%';
