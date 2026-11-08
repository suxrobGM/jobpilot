-- Goals give way to searches and rules the user steers from chat. Each user's goals text moves
-- into the thread as their own message, followed by a pilot note so no chat.reply run starts.
INSERT INTO "pilot_messages" ("id", "user_id", "author", "body", "created_at")
SELECT gen_random_uuid(), "user_id", 'user',
    E'What I''m looking for (moved here from the Goals page):\n\n' || btrim("goals"), now()
FROM "pilot_states"
WHERE btrim("goals") <> '';

INSERT INTO "pilot_messages" ("id", "user_id", "author", "body", "created_at")
SELECT gen_random_uuid(), "user_id", 'pilot',
    'The Goals page is gone: I work from your searches and rules now. Tell me here whenever you want something different, and I''ll update them.',
    now() + interval '1 millisecond'
FROM "pilot_states"
WHERE btrim("goals") <> '';

-- Stored changes must parse without `goals.set` and `jobs.skipApproved`. A change keeps its undo
-- (a skip's `jobs.restore`) even when no action is left to show.
UPDATE "pilot_changes" c
SET "actions" = COALESCE((
        SELECT jsonb_agg(t.action ORDER BY t.n)
        FROM jsonb_array_elements(c."actions") WITH ORDINALITY AS t(action, n)
        WHERE t.action->>'type' NOT IN ('goals.set', 'jobs.skipApproved')
    ), '[]'::jsonb),
    "undo" = CASE WHEN c."undo" IS NULL THEN NULL ELSE COALESCE((
        SELECT jsonb_agg(t.action ORDER BY t.n)
        FROM jsonb_array_elements(c."undo") WITH ORDINALITY AS t(action, n)
        WHERE t.action->>'type' <> 'goals.set'
    ), '[]'::jsonb) END
WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(c."actions") AS a(action)
        WHERE a.action->>'type' IN ('goals.set', 'jobs.skipApproved')
    )
    OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(c."undo", '[]'::jsonb)) AS u(action)
        WHERE u.action->>'type' = 'goals.set'
    );

DELETE FROM "pilot_changes"
WHERE "actions" = '[]'::jsonb AND COALESCE("undo", '[]'::jsonb) = '[]'::jsonb;

-- Old runs' payloads still parse through the task schemas.
UPDATE "pilot_runs"
SET "payload" = "payload" - 'goals'
WHERE "task_type" IN ('search.setup', 'research.explore') AND "payload" ? 'goals';

UPDATE "pilot_runs"
SET "title" = 'Set up searches'
WHERE "task_type" = 'search.setup' AND "title" = 'Set up searches from your goals';

UPDATE "pilot_states"
SET "task_list_snapshot" = NULL, "task_list_version" = NULL, "task_list_expires_at" = NULL;

ALTER TABLE "pilot_states" DROP COLUMN "goals",
DROP COLUMN "goals_updated_at";
