-- Board links are `board_id` everywhere else.
ALTER TABLE "credentials" RENAME COLUMN "job_board_id" TO "board_id";
ALTER TABLE "credentials" RENAME CONSTRAINT "credentials_job_board_id_fkey" TO "credentials_board_id_fkey";
ALTER INDEX "credentials_job_board_id_idx" RENAME TO "credentials_board_id_idx";
ALTER INDEX "credentials_user_id_job_board_id_key" RENAME TO "credentials_user_id_board_id_key";

ALTER TABLE "user_job_boards" RENAME COLUMN "job_board_id" TO "board_id";
ALTER TABLE "user_job_boards" RENAME CONSTRAINT "user_job_boards_job_board_id_fkey" TO "user_job_boards_board_id_fkey";
ALTER INDEX "user_job_boards_job_board_id_idx" RENAME TO "user_job_boards_board_id_idx";
ALTER INDEX "user_job_boards_user_id_job_board_id_key" RENAME TO "user_job_boards_user_id_board_id_key";

-- Application links are `application_id`, as on cover letters and resume variants.
ALTER TABLE "email_messages" RENAME COLUMN "matched_app_id" TO "application_id";
ALTER TABLE "email_messages" RENAME CONSTRAINT "email_messages_matched_app_id_fkey" TO "email_messages_application_id_fkey";
ALTER INDEX "email_messages_matched_app_id_idx" RENAME TO "email_messages_application_id_idx";
-- A 0..1 confidence, not the 0..100 fit score `match_score` means on applications.
ALTER TABLE "email_messages" RENAME COLUMN "match_score" TO "match_confidence";
ALTER TABLE "email_messages" RENAME COLUMN "applied_status" TO "resulting_status";

ALTER TABLE "contacts" RENAME COLUMN "related_app_id" TO "application_id";
ALTER TABLE "contacts" RENAME CONSTRAINT "contacts_related_app_id_fkey" TO "contacts_application_id_fkey";
ALTER INDEX "contacts_related_app_id_idx" RENAME TO "contacts_application_id_idx";
ALTER TABLE "contacts" RENAME COLUMN "related_job_url" TO "job_url";

-- Matches job_listings.employment_type.
ALTER TABLE "campaign_jobs" RENAME COLUMN "type" TO "employment_type";
