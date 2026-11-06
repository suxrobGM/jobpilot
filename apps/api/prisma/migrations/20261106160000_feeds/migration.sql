-- Feeds replace pilot searches and campaigns: one place every job comes from. A search keeps its
-- id as a feed; every other campaign folds into its user's one feed of that kind.

CREATE TYPE "feed_kind" AS ENUM ('search', 'job_alerts', 'research', 'links', 'manual', 'upwork', 'networking');

CREATE TABLE "feeds" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "feed_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT,
    "board_id" UUID,
    "resume_id" UUID,
    "reason" TEXT NOT NULL DEFAULT '',
    "config" JSONB NOT NULL DEFAULT '{}',
    "paused_at" TIMESTAMPTZ(3),
    "paused_by" "actor",
    "paused_reason" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_by" "actor" NOT NULL DEFAULT 'user',
    "last_run_at" TIMESTAMPTZ(3),
    "last_jobs_scanned" INTEGER,
    "last_new_jobs" INTEGER,
    "empty_runs" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feeds_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "job_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "feeds_user_id_kind_idx" ON "feeds"("user_id", "kind");
CREATE INDEX "feeds_user_id_next_run_at_idx" ON "feeds"("user_id", "next_run_at");
CREATE INDEX "feeds_user_id_updated_at_idx" ON "feeds"("user_id", "updated_at");
CREATE INDEX "feeds_board_id_idx" ON "feeds"("board_id");
CREATE INDEX "feeds_resume_id_idx" ON "feeds"("resume_id");
-- One feed per user for every kind but `search`.
CREATE UNIQUE INDEX "feeds_user_id_kind_key" ON "feeds"("user_id", "kind") WHERE "kind" <> 'search';

-- 1. Searches keep their ids. Config and pause come from the search's open campaign.
INSERT INTO "feeds" (
    "id", "user_id", "kind", "name", "query", "board_id", "resume_id", "reason", "config",
    "paused_at", "paused_by", "paused_reason", "created_by", "last_run_at", "last_jobs_scanned",
    "last_new_jobs", "empty_runs", "next_run_at", "created_at", "updated_at"
)
SELECT
    s."id", s."user_id", 'search', s."name", s."query", s."board_id", s."resume_id", s."reason",
    CASE WHEN c."config" ? 'minScore'
        THEN jsonb_build_object('minScore', c."config"->'minScore') ELSE '{}'::jsonb END,
    CASE WHEN c."status" = 'paused' THEN c."updated_at" END,
    CASE WHEN c."status" = 'paused' THEN c."status_changed_by" END,
    CASE WHEN c."status" = 'paused' THEN c."status_reason" END,
    'pilot', s."last_run_at", s."last_jobs_scanned", s."last_new_jobs", s."empty_runs",
    s."next_run_at", s."created_at", s."updated_at"
FROM "pilot_searches" s
LEFT JOIN LATERAL (
    SELECT * FROM "campaigns" c
    WHERE c."pilot_search_id" = s."id" AND c."status" IN ('in_progress', 'paused')
    ORDER BY c."started_at" DESC
    LIMIT 1
) c ON true;

-- 2. Every campaign's feed kind, by what it was for.
CREATE TABLE "_campaign_feeds" (
    "campaign_id" UUID PRIMARY KEY,
    "user_id" UUID NOT NULL,
    "kind" "feed_kind" NOT NULL,
    "feed_id" UUID
);
INSERT INTO "_campaign_feeds" ("campaign_id", "user_id", "kind", "feed_id")
SELECT
    c."id", c."user_id",
    (CASE
        WHEN c."pilot_search_id" IS NOT NULL THEN 'search'
        WHEN c."feed" IS NOT NULL THEN c."feed"::text
        WHEN c."source" = 'networking' THEN 'networking'
        WHEN b."domain" = 'upwork.com' OR b."domain" LIKE '%.upwork.com' THEN 'upwork'
        ELSE 'manual'
    END)::"feed_kind",
    c."pilot_search_id"
FROM "campaigns" c
LEFT JOIN "job_boards" b ON b."id" = c."board_id";

-- 3. One feed per (user, kind) for the rest, keeping the newest open campaign's id and pause.
INSERT INTO "feeds" (
    "id", "user_id", "kind", "name", "paused_at", "paused_by", "paused_reason", "created_by",
    "created_at", "updated_at"
)
SELECT DISTINCT ON (m."user_id", m."kind")
    c."id", m."user_id", m."kind",
    CASE m."kind"
        WHEN 'job_alerts' THEN 'Job alerts'
        WHEN 'research' THEN 'Research'
        WHEN 'links' THEN 'Links you added'
        WHEN 'manual' THEN 'Your own runs'
        WHEN 'upwork' THEN 'Upwork'
        ELSE 'Networking'
    END,
    CASE WHEN m."kind" IN ('job_alerts', 'research', 'links', 'networking') AND c."status" = 'paused'
        THEN c."updated_at" END,
    CASE WHEN m."kind" IN ('job_alerts', 'research', 'links', 'networking') AND c."status" = 'paused'
        THEN c."status_changed_by" END,
    CASE WHEN m."kind" IN ('job_alerts', 'research', 'links', 'networking') AND c."status" = 'paused'
        THEN c."status_reason" END,
    CASE WHEN m."kind" IN ('job_alerts', 'research') THEN 'pilot'::"actor" ELSE 'user'::"actor" END,
    c."started_at", now()
FROM "_campaign_feeds" m
JOIN "campaigns" c ON c."id" = m."campaign_id"
WHERE m."kind" <> 'search'
ORDER BY m."user_id", m."kind", (c."status" IN ('in_progress', 'paused')) DESC, c."started_at" DESC;

UPDATE "_campaign_feeds" m SET "feed_id" = f."id"
FROM "feeds" f
WHERE m."kind" <> 'search' AND f."user_id" = m."user_id" AND f."kind" = m."kind";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "_campaign_feeds" WHERE "feed_id" IS NULL) THEN
        RAISE EXCEPTION 'a campaign has no feed';
    END IF;
END $$;

-- 4. Jobs move to their campaign's feed. Two copies of a posting in one feed keep the most
-- advanced; applications and proposals move to it first.
ALTER TABLE "campaign_jobs" RENAME TO "jobs";
ALTER TABLE "jobs" RENAME CONSTRAINT "campaign_jobs_pkey" TO "jobs_pkey";
ALTER TABLE "jobs" RENAME CONSTRAINT "campaign_jobs_board_id_fkey" TO "jobs_board_id_fkey";
ALTER TABLE "jobs" RENAME CONSTRAINT "campaign_jobs_user_id_fkey" TO "jobs_user_id_fkey";
ALTER TABLE "jobs" DROP CONSTRAINT "campaign_jobs_campaign_id_fkey";
ALTER INDEX "campaign_jobs_board_id_idx" RENAME TO "jobs_board_id_idx";
ALTER INDEX "campaign_jobs_status_updated_at_idx" RENAME TO "jobs_status_updated_at_idx";
ALTER INDEX "campaign_jobs_user_id_created_at_idx" RENAME TO "jobs_user_id_created_at_idx";
ALTER INDEX "campaign_jobs_user_id_status_updated_at_idx" RENAME TO "jobs_user_id_status_updated_at_idx";
ALTER INDEX "campaign_jobs_user_id_updated_at_idx" RENAME TO "jobs_user_id_updated_at_idx";
DROP INDEX "campaign_jobs_campaign_id_key_key";
DROP INDEX "campaign_jobs_campaign_id_status_idx";
ALTER TYPE "campaign_job_status" RENAME TO "job_status";

ALTER TABLE "jobs" ADD COLUMN "feed_id" UUID;
UPDATE "jobs" j SET "feed_id" = m."feed_id"
FROM "_campaign_feeds" m
WHERE m."campaign_id" = j."campaign_id";

CREATE TABLE "_job_winners" AS
SELECT "id", first_value("id") OVER (
    PARTITION BY "feed_id", "key"
    ORDER BY
        CASE "status"
            WHEN 'applied' THEN 7 WHEN 'applying' THEN 6 WHEN 'needs_user' THEN 5
            WHEN 'approved' THEN 4 WHEN 'failed' THEN 3 WHEN 'skipped' THEN 2
            WHEN 'pending' THEN 1 ELSE 0
        END DESC,
        "updated_at" DESC,
        "id"
) AS "winner_id"
FROM "jobs";
UPDATE "applications" a SET "job_id" = w."winner_id"
FROM "_job_winners" w WHERE a."job_id" = w."id" AND w."id" <> w."winner_id";
UPDATE "upwork_proposals" p SET "job_id" = w."winner_id"
FROM "_job_winners" w WHERE p."job_id" = w."id" AND w."id" <> w."winner_id";
DELETE FROM "jobs" j USING "_job_winners" w WHERE j."id" = w."id" AND w."id" <> w."winner_id";
DROP TABLE "_job_winners";

ALTER TABLE "jobs" ALTER COLUMN "feed_id" SET NOT NULL;
ALTER TABLE "jobs" DROP COLUMN "campaign_id";
CREATE UNIQUE INDEX "jobs_feed_id_key_key" ON "jobs"("feed_id", "key");
CREATE INDEX "jobs_feed_id_status_idx" ON "jobs"("feed_id", "status");
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Applications and outreach point at the feed.
ALTER TABLE "applications" ADD COLUMN "feed_id" UUID;
UPDATE "applications" a SET "feed_id" = m."feed_id"
FROM "_campaign_feeds" m WHERE m."campaign_id" = a."campaign_id";
ALTER TABLE "applications" DROP CONSTRAINT "applications_campaign_id_fkey";
DROP INDEX "applications_campaign_id_idx";
ALTER TABLE "applications" DROP COLUMN "campaign_id";
CREATE INDEX "applications_feed_id_idx" ON "applications"("feed_id");
ALTER TABLE "applications" ADD CONSTRAINT "applications_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "networking_messages" ADD COLUMN "feed_id" UUID;
UPDATE "networking_messages" n SET "feed_id" = m."feed_id"
FROM "_campaign_feeds" m WHERE m."campaign_id" = n."campaign_id";
ALTER TABLE "networking_messages" DROP CONSTRAINT "networking_messages_campaign_id_fkey";
DROP INDEX "networking_messages_campaign_id_status_idx";
ALTER TABLE "networking_messages" DROP COLUMN "campaign_id";
CREATE INDEX "networking_messages_feed_id_status_idx" ON "networking_messages"("feed_id", "status");
ALTER TABLE "networking_messages" ADD CONSTRAINT "networking_messages_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Subjects that named a campaign name its feed; job subjects are `<feedId>:<key>`.
ALTER TYPE "pilot_subject_type" RENAME VALUE 'campaign' TO 'feed';
ALTER TYPE "application_event_source" RENAME VALUE 'campaign' TO 'feed';

UPDATE "pilot_runs" r SET "subject_id" = m."feed_id"::text
FROM "_campaign_feeds" m WHERE r."subject_type" = 'feed' AND r."subject_id" = m."campaign_id"::text;
UPDATE "pilot_runs" r SET "subject_id" = m."feed_id"::text || substr(r."subject_id", 37)
FROM "_campaign_feeds" m WHERE r."subject_type" = 'job' AND left(r."subject_id", 36) = m."campaign_id"::text;
UPDATE "pilot_questions" q SET "subject_id" = m."feed_id"::text
FROM "_campaign_feeds" m WHERE q."subject_type" = 'feed' AND q."subject_id" = m."campaign_id"::text;
UPDATE "pilot_questions" q SET "subject_id" = m."feed_id"::text || substr(q."subject_id", 37)
FROM "_campaign_feeds" m WHERE q."subject_type" = 'job' AND left(q."subject_id", 36) = m."campaign_id"::text;
UPDATE "pilot_journal_entries" e SET "subject_id" = m."feed_id"::text
FROM "_campaign_feeds" m WHERE e."subject_type" = 'feed' AND e."subject_id" = m."campaign_id"::text;
UPDATE "pilot_journal_entries" e SET "subject_id" = m."feed_id"::text || substr(e."subject_id", 37)
FROM "_campaign_feeds" m WHERE e."subject_type" = 'job' AND left(e."subject_id", 36) = m."campaign_id"::text;
UPDATE "pilot_requests" r SET "subject_id" = m."feed_id"::text
FROM "_campaign_feeds" m WHERE r."subject_type" = 'feed' AND r."subject_id" = m."campaign_id"::text;
UPDATE "pilot_requests" r SET "subject_id" = m."feed_id"::text || substr(r."subject_id", 37)
FROM "_campaign_feeds" m WHERE r."subject_type" = 'job' AND left(r."subject_id", 36) = m."campaign_id"::text;

-- 7. Task types and payloads follow: `campaignId` becomes `feedId`; a search is its own feed.
UPDATE "pilot_runs" SET "task_type" = CASE "task_type"
    WHEN 'campaign.scorePending' THEN 'feed.score'
    WHEN 'campaign.reviewPaused' THEN 'search.review'
    ELSE 'search.tune'
END
WHERE "task_type" IN ('campaign.scorePending', 'campaign.reviewPaused', 'campaign.tune');

UPDATE "pilot_runs" SET "payload" = "payload" - 'campaignId' WHERE "task_type" = 'search.discover';
UPDATE "pilot_runs" r
SET "payload" = (r."payload" - 'campaignId') || jsonb_build_object('feedId', m."feed_id")
FROM "_campaign_feeds" m
WHERE r."payload" ? 'campaignId' AND r."payload"->>'campaignId' = m."campaign_id"::text;
UPDATE "pilot_runs" r
SET "payload" = jsonb_set(
    r."payload", '{testJob}',
    ((r."payload"->'testJob') - 'campaignId') || jsonb_build_object('feedId', m."feed_id")
)
FROM "_campaign_feeds" m
WHERE jsonb_typeof(r."payload"->'testJob') = 'object'
    AND r."payload"->'testJob'->>'campaignId' = m."campaign_id"::text;
UPDATE "pilot_requests" r
SET "payload" = (r."payload" - 'campaignId') || jsonb_build_object('feedId', m."feed_id")
FROM "_campaign_feeds" m
WHERE r."payload" ? 'campaignId' AND r."payload"->>'campaignId' = m."campaign_id"::text;

UPDATE "pilot_runs" r SET "payload" = jsonb_set(r."payload", '{subjectId}', to_jsonb(m."feed_id"::text))
FROM "_campaign_feeds" m
WHERE r."task_type" = 'question.answered'
    AND r."payload"->>'subjectType' = 'campaign'
    AND r."payload"->>'subjectId' = m."campaign_id"::text;
UPDATE "pilot_runs" SET "payload" = jsonb_set("payload", '{subjectType}', '"feed"')
WHERE "task_type" = 'question.answered' AND "payload"->>'subjectType' = 'campaign';
-- A run whose campaign is gone keeps the old id under the new key.
UPDATE "pilot_runs"
SET "payload" = ("payload" - 'campaignId') || jsonb_build_object('feedId', "payload"->'campaignId')
WHERE "payload" ? 'campaignId';
UPDATE "pilot_runs"
SET "payload" = jsonb_set(
    "payload", '{testJob}',
    (("payload"->'testJob') - 'campaignId') || jsonb_build_object('feedId', "payload"->'testJob'->'campaignId')
)
WHERE jsonb_typeof("payload"->'testJob') = 'object' AND "payload"->'testJob' ? 'campaignId';
UPDATE "pilot_requests"
SET "payload" = ("payload" - 'campaignId') || jsonb_build_object('feedId', "payload"->'campaignId')
WHERE "payload" ? 'campaignId';

-- Changes store job refs as `{campaignId, key}`; rename the key, then remap the few ids that moved.
UPDATE "pilot_changes"
SET "actions" = replace("actions"::text, '"campaignId"', '"feedId"')::jsonb,
    "undo" = replace("undo"::text, '"campaignId"', '"feedId"')::jsonb
WHERE "actions"::text LIKE '%"campaignId"%' OR "undo"::text LIKE '%"campaignId"%';
DO $$
DECLARE
    moved RECORD;
BEGIN
    FOR moved IN
        SELECT m."campaign_id"::text AS old_id, m."feed_id"::text AS new_id
        FROM "_campaign_feeds" m
        WHERE m."campaign_id" <> m."feed_id" AND EXISTS (
            SELECT 1 FROM "pilot_changes" c
            WHERE c."actions"::text LIKE '%' || m."campaign_id"::text || '%'
                OR c."undo"::text LIKE '%' || m."campaign_id"::text || '%'
        )
    LOOP
        UPDATE "pilot_changes"
        SET "actions" = replace("actions"::text, moved.old_id, moved.new_id)::jsonb,
            "undo" = replace("undo"::text, moved.old_id, moved.new_id)::jsonb
        WHERE "actions"::text LIKE '%' || moved.old_id || '%' OR "undo"::text LIKE '%' || moved.old_id || '%';
    END LOOP;
END $$;

UPDATE "pilot_states" SET "task_list_version" = NULL, "task_list_expires_at" = NULL, "task_list_snapshot" = NULL;

-- 8. The old shapes go.
DROP TABLE "_campaign_feeds";
DROP TABLE "campaigns";
DROP TABLE "pilot_searches";
DROP TYPE "campaign_source";
DROP TYPE "campaign_status";
DROP TYPE "campaign_feed";
