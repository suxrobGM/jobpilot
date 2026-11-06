-- Runs keep the payload shape of the day they started, and the pilot thread parses every run it
-- shows. Bring the shapes earlier migrations missed up to taskFieldsSchema.

-- 20261104020000 made job briefs JSON objects; run payloads still held them as text.
UPDATE "pilot_runs"
SET "payload" = jsonb_set("payload", '{brief}', ("payload"->>'brief')::jsonb)
WHERE "task_type" = 'job.apply' AND jsonb_typeof("payload"->'brief') = 'string';

UPDATE "pilot_runs"
SET "payload" = ("payload" - 'jobBoardId') || jsonb_build_object('boardId', "payload"->'jobBoardId')
WHERE "task_type" = 'board.diagnose' AND "payload" ? 'jobBoardId';

-- `resumeId` is optional; a malformed one can't point at a resume.
UPDATE "pilot_runs"
SET "payload" = "payload" - 'resumeId'
WHERE "task_type" = 'search.discover'
  AND "payload" ? 'resumeId'
  AND "payload"->>'resumeId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "pilot_runs"
    WHERE "task_type" = 'job.apply' AND jsonb_typeof("payload"->'brief') NOT IN ('object', 'null')
  ) THEN
    RAISE EXCEPTION 'pilot_runs.payload holds a job.apply brief that is not a JSON object';
  END IF;
END $$;
