-- Sync lists mail since lastSyncAt instead of following a Gmail history cursor.
ALTER TABLE "email_accounts" DROP COLUMN "history_id";
ALTER TABLE "email_accounts" ADD COLUMN "cleared_before" TIMESTAMPTZ(3);
