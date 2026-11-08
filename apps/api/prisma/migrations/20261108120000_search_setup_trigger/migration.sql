-- search.setup payloads gain `trigger`; every earlier run was the pilot's own.
UPDATE "pilot_runs"
SET "payload" = "payload" || '{"trigger": "auto"}'::jsonb
WHERE "task_type" = 'search.setup' AND NOT "payload" ? 'trigger';

UPDATE "pilot_states"
SET "task_list_snapshot" = NULL, "task_list_version" = NULL, "task_list_expires_at" = NULL;
