-- The application detail page resolves its posting with `where campaign_id = ? and url = ?`, and no
-- existing index covers url. Postgres scanned the campaign's whole job set and heap-fetched every
-- row, each carrying the wide `description` and `digest` columns, to find one.

-- CreateIndex
CREATE INDEX "jobs_campaign_id_url_idx" ON "jobs"("campaign_id", "url");
