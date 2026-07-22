-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "pilot_search_id" TEXT;

-- CreateIndex
CREATE INDEX "campaigns_user_id_pilot_search_id_idx" ON "campaigns"("user_id", "pilot_search_id");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_pilot_search_id_fkey" FOREIGN KEY ("pilot_search_id") REFERENCES "pilot_searches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: adopt the campaigns discovery already spawned. Until now the gather re-derived the
-- link by matching campaign.query against pilot_search.query, so a query edit orphaned the campaign.
-- Only in-progress auto-apply campaigns can still be appended to; the oldest search wins when two
-- searches share a query on different boards.
UPDATE "campaigns" c
SET "pilot_search_id" = s."id"
FROM (
    SELECT DISTINCT ON ("user_id", "query") "user_id", "query", "id"
    FROM "pilot_searches"
    ORDER BY "user_id", "query", "created_at", "id"
) s
WHERE c."user_id" = s."user_id"
  AND c."query" = s."query"
  AND c."source" = 'auto-apply'
  AND c."status" = 'in_progress';
