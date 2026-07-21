-- Indexes for the daily retention sweep and the pilot activity probe. Without these the sweep
-- sequential-scans the two largest remaining tables and the two-minute probe heap-reads every job
-- and campaign row the user owns just to take a MAX(updated_at).

CREATE INDEX "email_messages_received_at_idx" ON "email_messages"("received_at");
CREATE INDEX "promotion_posts_updated_at_idx" ON "promotion_posts"("updated_at");
CREATE INDEX "jobs_campaign_id_updated_at_idx" ON "jobs"("campaign_id", "updated_at");
CREATE INDEX "campaigns_user_id_updated_at_idx" ON "campaigns"("user_id", "updated_at");
