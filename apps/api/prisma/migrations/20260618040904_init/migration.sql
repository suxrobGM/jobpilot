-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "verification_token_type" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "application" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "board" TEXT,
    "source" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "outcome" TEXT,
    "rejected_at" TIMESTAMP(3),
    "match_score" INTEGER,
    "match_reason" TEXT,
    "fail_reason" TEXT,
    "campaign_id" TEXT,
    "normalized_title" TEXT NOT NULL,
    "normalized_company" TEXT NOT NULL,

    CONSTRAINT "application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_event" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "from_stage" TEXT,
    "to_stage" TEXT NOT NULL,
    "note" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "wrapped_dek" TEXT,
    "dek_key_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "verification_token_type" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_cipher" TEXT,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign" (
    "campaign_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "config" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("campaign_id")
);

-- CreateTable
CREATE TABLE "campaign_event" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_letter" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "job_url" TEXT,
    "job_title" TEXT,
    "company" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cover_letter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "api_key" TEXT,

    CONSTRAINT "credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_account" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "history_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_message" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "subject" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "from_name" TEXT,
    "from_domain" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "raw_body" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanned_at" TIMESTAMP(3),
    "classification" TEXT,
    "confidence" DOUBLE PRECISION,
    "reasoning" TEXT,
    "matched_app_id" TEXT,
    "match_score" DOUBLE PRECISION,
    "review_status" TEXT NOT NULL DEFAULT 'pending',
    "applied_stage" TEXT,
    "verification_code" TEXT,
    "verification_link" TEXT,
    "verification_domain" TEXT,

    CONSTRAINT "email_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_board" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "search_url" TEXT,
    "email" TEXT,
    "password" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "salary" TEXT,
    "type" TEXT,
    "url" TEXT NOT NULL,
    "board" TEXT,
    "match_score" INTEGER,
    "match_reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "applied_at" TIMESTAMP(3),
    "fail_reason" TEXT,
    "retry_notes" TEXT,
    "skip_reason" TEXT,
    "description" TEXT,
    "digest" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "linkedin_url" TEXT,
    "email" TEXT,
    "email_source" TEXT,
    "email_confidence" DOUBLE PRECISION,
    "linkedin_connection" TEXT NOT NULL DEFAULT 'none',
    "discovery_source" TEXT,
    "match_confidence" DOUBLE PRECISION,
    "related_app_id" TEXT,
    "related_job_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_message" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "channel" TEXT NOT NULL,
    "linkedin_kind" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "fail_reason" TEXT,
    "provider_id" TEXT,
    "thread_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "github" TEXT,
    "street" TEXT,
    "apt_unit" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "country" TEXT,
    "us_authorized" BOOLEAN NOT NULL DEFAULT false,
    "requires_sponsorship" BOOLEAN NOT NULL DEFAULT false,
    "visa_status" TEXT,
    "opt_extension" TEXT,
    "willing_to_relocate" BOOLEAN NOT NULL DEFAULT false,
    "preferred_locations" TEXT NOT NULL DEFAULT '[]',
    "eeo_gender" TEXT,
    "eeo_race" TEXT,
    "eeo_ethnicity" TEXT,
    "eeo_hispanic_or_latino" TEXT,
    "eeo_veteran_status" TEXT,
    "eeo_disability_status" TEXT,
    "primary_resume_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_apply_settings" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "min_match_score" INTEGER NOT NULL DEFAULT 70,
    "max_applications_per_campaign" INTEGER,
    "default_start_date" TEXT NOT NULL DEFAULT '2 weeks notice',

    CONSTRAINT "auto_apply_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_entry" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "queue_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source_filename" TEXT,
    "source_mime_type" TEXT,
    "source_size_bytes" INTEGER,
    "content" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_variant" (
    "id" TEXT NOT NULL,
    "resume_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "job_url" TEXT,
    "application_id" TEXT,
    "content" TEXT NOT NULL,
    "diff_notes" TEXT,
    "rewrites" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upwork_proposal" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "client_name" TEXT,
    "job_url" TEXT,
    "job_description" TEXT,
    "proposal_text" TEXT NOT NULL DEFAULT '',
    "screening_answers" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "outcome" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "campaign_id" TEXT,
    "job_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "upwork_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upwork_profile" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "current_title" TEXT,
    "current_overview" TEXT,
    "current_hourly_rate" TEXT,
    "current_portfolio" TEXT NOT NULL DEFAULT '[]',
    "suggested_title" TEXT,
    "suggested_overview" TEXT,
    "suggested_hourly_rate" TEXT,
    "suggested_portfolio" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'empty',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "upwork_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_profile_id_idx" ON "application"("profile_id");

-- CreateIndex
CREATE INDEX "application_normalized_title_normalized_company_idx" ON "application"("normalized_title", "normalized_company");

-- CreateIndex
CREATE INDEX "application_applied_at_idx" ON "application"("applied_at");

-- CreateIndex
CREATE INDEX "application_campaign_id_idx" ON "application"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_profile_id_url_key" ON "application"("profile_id", "url");

-- CreateIndex
CREATE INDEX "stage_event_application_id_occurred_at_idx" ON "stage_event"("application_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_token_hash_key" ON "verification_token"("token_hash");

-- CreateIndex
CREATE INDEX "verification_token_user_id_idx" ON "verification_token"("user_id");

-- CreateIndex
CREATE INDEX "verification_token_expires_at_idx" ON "verification_token"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token"("user_id");

-- CreateIndex
CREATE INDEX "refresh_token_expires_at_idx" ON "refresh_token"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_token_token_hash_key" ON "api_token"("token_hash");

-- CreateIndex
CREATE INDEX "api_token_user_id_idx" ON "api_token"("user_id");

-- CreateIndex
CREATE INDEX "campaign_profile_id_idx" ON "campaign"("profile_id");

-- CreateIndex
CREATE INDEX "campaign_event_campaign_id_created_at_idx" ON "campaign_event"("campaign_id", "created_at");

-- CreateIndex
CREATE INDEX "cover_letter_profile_id_created_at_idx" ON "cover_letter"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "credential_profile_id_idx" ON "credential"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "credential_profile_id_scope_key" ON "credential"("profile_id", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "email_account_profile_id_key" ON "email_account"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_message_provider_id_key" ON "email_message"("provider_id");

-- CreateIndex
CREATE INDEX "email_message_review_status_received_at_idx" ON "email_message"("review_status", "received_at");

-- CreateIndex
CREATE INDEX "email_message_matched_app_id_idx" ON "email_message"("matched_app_id");

-- CreateIndex
CREATE INDEX "email_message_from_domain_received_at_idx" ON "email_message"("from_domain", "received_at");

-- CreateIndex
CREATE INDEX "email_message_verification_domain_received_at_idx" ON "email_message"("verification_domain", "received_at");

-- CreateIndex
CREATE INDEX "job_board_profile_id_idx" ON "job_board"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_board_profile_id_domain_key" ON "job_board"("profile_id", "domain");

-- CreateIndex
CREATE INDEX "job_campaign_id_status_idx" ON "job"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "job_campaign_id_key_key" ON "job"("campaign_id", "key");

-- CreateIndex
CREATE INDEX "contact_profile_id_idx" ON "contact"("profile_id");

-- CreateIndex
CREATE INDEX "contact_profile_id_company_idx" ON "contact"("profile_id", "company");

-- CreateIndex
CREATE INDEX "outreach_message_profile_id_idx" ON "outreach_message"("profile_id");

-- CreateIndex
CREATE INDEX "outreach_message_campaign_id_idx" ON "outreach_message"("campaign_id");

-- CreateIndex
CREATE INDEX "outreach_message_contact_id_idx" ON "outreach_message"("contact_id");

-- CreateIndex
CREATE INDEX "outreach_message_thread_id_idx" ON "outreach_message"("thread_id");

-- CreateIndex
CREATE INDEX "outreach_message_status_idx" ON "outreach_message"("status");

-- CreateIndex
CREATE UNIQUE INDEX "profile_user_id_key" ON "profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_primary_resume_id_key" ON "profile"("primary_resume_id");

-- CreateIndex
CREATE INDEX "profile_user_id_idx" ON "profile"("user_id");

-- CreateIndex
CREATE INDEX "reference_profile_id_idx" ON "reference"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "auto_apply_settings_profile_id_key" ON "auto_apply_settings"("profile_id");

-- CreateIndex
CREATE INDEX "queue_entry_profile_id_status_idx" ON "queue_entry"("profile_id", "status");

-- CreateIndex
CREATE INDEX "queue_entry_status_idx" ON "queue_entry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "queue_entry_profile_id_url_key" ON "queue_entry"("profile_id", "url");

-- CreateIndex
CREATE INDEX "resume_profile_id_idx" ON "resume"("profile_id");

-- CreateIndex
CREATE INDEX "resume_variant_resume_id_idx" ON "resume_variant"("resume_id");

-- CreateIndex
CREATE INDEX "resume_variant_application_id_idx" ON "resume_variant"("application_id");

-- CreateIndex
CREATE INDEX "upwork_proposal_profile_id_idx" ON "upwork_proposal"("profile_id");

-- CreateIndex
CREATE INDEX "upwork_proposal_profile_id_status_idx" ON "upwork_proposal"("profile_id", "status");

-- CreateIndex
CREATE INDEX "upwork_proposal_campaign_id_idx" ON "upwork_proposal"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "upwork_profile_profile_id_key" ON "upwork_profile"("profile_id");

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("campaign_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_event" ADD CONSTRAINT "stage_event_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_token" ADD CONSTRAINT "verification_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_event" ADD CONSTRAINT "campaign_event_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_letter" ADD CONSTRAINT "cover_letter_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "credential_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_account" ADD CONSTRAINT "email_account_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "email_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_matched_app_id_fkey" FOREIGN KEY ("matched_app_id") REFERENCES "application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_board" ADD CONSTRAINT "job_board_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_related_app_id_fkey" FOREIGN KEY ("related_app_id") REFERENCES "application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_message" ADD CONSTRAINT "outreach_message_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("campaign_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_primary_resume_id_fkey" FOREIGN KEY ("primary_resume_id") REFERENCES "resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference" ADD CONSTRAINT "reference_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_apply_settings" ADD CONSTRAINT "auto_apply_settings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entry" ADD CONSTRAINT "queue_entry_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume" ADD CONSTRAINT "resume_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_variant" ADD CONSTRAINT "resume_variant_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_variant" ADD CONSTRAINT "resume_variant_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upwork_proposal" ADD CONSTRAINT "upwork_proposal_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upwork_profile" ADD CONSTRAINT "upwork_profile_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
