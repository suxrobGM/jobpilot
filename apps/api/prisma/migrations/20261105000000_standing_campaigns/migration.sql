-- Pilot feeds keep one standing campaign each. Data steps run before the unique indexes they enable.
CREATE TYPE "campaign_feed" AS ENUM ('job_alerts', 'research');

ALTER TABLE "campaigns" ADD COLUMN "feed" "campaign_feed";

-- A search keeps its newest open campaign; older open ones lose the link and drain like any other.
UPDATE "campaigns" AS c
SET "pilot_search_id" = NULL
WHERE c."pilot_search_id" IS NOT NULL
  AND c."status" IN ('in_progress', 'paused')
  AND EXISTS (
    SELECT 1 FROM "campaigns" AS newer
    WHERE newer."pilot_search_id" = c."pilot_search_id"
      AND newer."status" IN ('in_progress', 'paused')
      AND (newer."started_at", newer."id") > (c."started_at", c."id")
  );

-- Each user's newest open job-alerts campaign becomes the standing one; older open ones drain.
UPDATE "campaigns" AS c
SET "feed" = 'job_alerts', "query" = 'Job alerts'
WHERE c."id" IN (
  SELECT DISTINCT ON ("user_id") "id"
  FROM "campaigns"
  WHERE "created_by" = 'pilot'
    AND "query" LIKE 'Job alerts · %'
    AND "status" IN ('in_progress', 'paused')
  ORDER BY "user_id", "started_at" DESC, "id" DESC
);

CREATE UNIQUE INDEX "campaigns_open_feed_key" ON "campaigns" ("user_id", "feed")
  WHERE "feed" IS NOT NULL AND "status" IN ('in_progress', 'paused');

CREATE UNIQUE INDEX "campaigns_open_search_key" ON "campaigns" ("pilot_search_id")
  WHERE "pilot_search_id" IS NOT NULL AND "status" IN ('in_progress', 'paused');
