-- Email reads are always scoped by account, so the filter indexes lead with it.
DROP INDEX "email_messages_review_status_received_at_idx";
DROP INDEX "email_messages_from_domain_received_at_idx";
DROP INDEX "email_messages_verification_domain_received_at_idx";
CREATE INDEX "email_messages_account_id_review_status_received_at_idx" ON "email_messages"("account_id", "review_status", "received_at");
CREATE INDEX "email_messages_account_id_from_domain_received_at_idx" ON "email_messages"("account_id", "from_domain", "received_at");
CREATE INDEX "email_messages_account_id_verification_domain_received_at_idx" ON "email_messages"("account_id", "verification_domain", "received_at");

-- Covered by a unique or composite index with the same leading column.
DROP INDEX "oauth_accounts_user_id_idx";
DROP INDEX "credentials_user_id_idx";
DROP INDEX "user_job_boards_user_id_idx";
DROP INDEX "contacts_user_id_idx";
DROP INDEX "upwork_proposals_user_id_idx";

-- Back the SetNull/Cascade foreign keys so a parent delete doesn't scan the child table.
CREATE INDEX "contacts_related_app_id_idx" ON "contacts"("related_app_id");
CREATE INDEX "campaigns_pilot_search_id_idx" ON "campaigns"("pilot_search_id");
CREATE INDEX "credentials_job_board_id_idx" ON "credentials"("job_board_id");
CREATE INDEX "user_job_boards_job_board_id_idx" ON "user_job_boards"("job_board_id");

-- Every expiry query also filters finished_at IS NULL; finished runs are history.
DROP INDEX "pilot_runs_user_id_expires_at_idx";
CREATE INDEX "pilot_runs_open_user_id_expires_at_idx" ON "pilot_runs"("user_id", "expires_at") WHERE "finished_at" IS NULL;
ALTER INDEX "pilot_leases_active_subject_unique" RENAME TO "pilot_runs_open_subject_key";
