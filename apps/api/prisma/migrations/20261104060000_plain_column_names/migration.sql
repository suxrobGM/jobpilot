-- Plain names for columns that read as jargon or misled.
ALTER TABLE "users" RENAME COLUMN "wrapped_dek" TO "encrypted_data_key";
ALTER TABLE "auth_tokens" RENAME COLUMN "token_cipher" TO "encrypted_token";
-- Plain text with quoted replies stripped at sync, not the raw message.
ALTER TABLE "email_messages" RENAME COLUMN "raw_body" TO "body";
ALTER TABLE "pilot_questions" RENAME COLUMN "deep_link" TO "link";
ALTER TABLE "pilot_questions" RENAME COLUMN "answer_key" TO "saved_answer_key";
ALTER TABLE "campaigns" RENAME COLUMN "status_actor" TO "status_changed_by";
ALTER TABLE "resume_variants" RENAME COLUMN "diff_notes" TO "change_notes";
ALTER TABLE "job_listings" RENAME COLUMN "dedupe_key" TO "match_key";
ALTER INDEX "job_listings_dedupe_key_key" RENAME TO "job_listings_match_key_key";
