-- Pending queue entries become one apply campaign per user, each entry a `queued` job.
-- Consumed/skipped history and entry notes are intentionally dropped.

WITH new_campaigns AS (
  INSERT INTO "campaigns" (
    "campaign_id", "user_id", "query", "source", "status", "created_by",
    "started_at", "updated_at", "config"
  )
  SELECT gen_random_uuid(), u."user_id", 'Queued links', 'apply'::"CampaignSource",
         'in_progress'::"CampaignStatus", 'user'::"CampaignActor", now(), now(), '{}'::jsonb
  FROM (SELECT DISTINCT "user_id" FROM "queue_entries" WHERE "status" = 'pending') u
  RETURNING "campaign_id", "user_id"
)
INSERT INTO "jobs" (
  "id", "campaign_id", "key", "title", "company", "url", "status", "created_at", "updated_at"
)
SELECT gen_random_uuid(), c."campaign_id", q."id",
       split_part(split_part(q."url", '://', 2), '/', 1), '', q."url",
       'queued'::"CampaignJobStatus", q."created_at", now()
FROM "queue_entries" q
JOIN new_campaigns c ON c."user_id" = q."user_id"
WHERE q."status" = 'pending';

DROP TABLE "queue_entries";

-- agenda_snapshot persists a whole AgendaResponse, so one holding the old queue-subject item
-- 500s on read until it expires. Discarding is lossless - the next refresh rebuilds it.
UPDATE "pilot_states"
SET "agenda_snapshot" = NULL,
    "agenda_expires_at" = NULL
WHERE "agenda_snapshot" IS NOT NULL;
