-- Enum types get snake_case names matching their tables.
ALTER TYPE "CampaignActor" RENAME TO "campaign_actor";
ALTER TYPE "CampaignJobStatus" RENAME TO "campaign_job_status";
ALTER TYPE "CampaignSource" RENAME TO "campaign_source";
ALTER TYPE "CampaignStatus" RENAME TO "campaign_status";
ALTER TYPE "ContactDiscoverySource" RENAME TO "contact_discovery_source";
ALTER TYPE "ContactEmailSource" RENAME TO "contact_email_source";
ALTER TYPE "ContactLinkedinConnection" RENAME TO "contact_linkedin_connection";
ALTER TYPE "LinkedinMessageKind" RENAME TO "linkedin_message_kind";
ALTER TYPE "NetworkingChannel" RENAME TO "networking_channel";
ALTER TYPE "NetworkingMessageStatus" RENAME TO "networking_message_status";
ALTER TYPE "PilotClaimOutcome" RENAME TO "pilot_claim_outcome";
ALTER TYPE "PilotJournalKind" RENAME TO "pilot_journal_kind";
ALTER TYPE "PilotQuestionKind" RENAME TO "pilot_question_kind";
ALTER TYPE "PilotQuestionStatus" RENAME TO "pilot_question_status";
ALTER TYPE "PromotionStatus" RENAME TO "promotion_status";

-- Values that could not be TypeScript identifiers, so every read and write paid for a translation.
ALTER TYPE "campaign_source" RENAME VALUE 'auto-apply' TO 'auto_apply';
ALTER TYPE "contact_discovery_source" RENAME VALUE 'company-site' TO 'company_site';
ALTER TYPE "pilot_question_kind" RENAME VALUE '2fa' TO 'two_factor';

CREATE TYPE "application_source" AS ENUM ('apply', 'auto_apply', 'manual', 'search', 'networking');
CREATE TYPE "application_event_kind" AS ENUM ('status_change', 'note', 'email');
CREATE TYPE "application_event_source" AS ENUM ('manual', 'email', 'campaign');
CREATE TYPE "availability" AS ENUM ('open', 'not_looking');
CREATE TYPE "cover_letter_source" AS ENUM ('apply', 'auto_apply', 'manual');
CREATE TYPE "email_provider" AS ENUM ('gmail', 'outlook', 'imap');
CREATE TYPE "email_classification" AS ENUM ('interviewing', 'rejected', 'offer', 'irrelevant', 'verification');
CREATE TYPE "email_review_status" AS ENUM ('pending', 'approved', 'denied', 'auto');
CREATE TYPE "upwork_proposal_status" AS ENUM ('draft', 'submitted', 'closed');
CREATE TYPE "upwork_proposal_outcome" AS ENUM ('hired', 'declined', 'no_response');
CREATE TYPE "upwork_proposal_source" AS ENUM ('manual', 'search');
CREATE TYPE "upwork_profile_status" AS ENUM ('empty', 'draft', 'approved', 'applied');
CREATE TYPE "upwork_inbox_kind" AS ENUM ('invitation', 'offer', 'message');
CREATE TYPE "upwork_inbox_status" AS ENUM ('unread', 'archived');

-- The text columns carried the old hyphenated spelling.
UPDATE "applications" SET "source" = 'auto_apply' WHERE "source" = 'auto-apply';
UPDATE "cover_letters" SET "source" = 'auto_apply' WHERE "source" = 'auto-apply';

ALTER TABLE "applications"
  ALTER COLUMN "source" TYPE "application_source" USING "source"::"application_source";

ALTER TABLE "application_events"
  ALTER COLUMN "kind" TYPE "application_event_kind" USING "kind"::"application_event_kind",
  ALTER COLUMN "source" TYPE "application_event_source" USING "source"::"application_event_source";

-- Unset and unrecognized both meant "no availability" while the column was text.
ALTER TABLE "users"
  ALTER COLUMN "availability" TYPE "availability"
  USING (CASE WHEN "availability" IN ('open', 'not_looking') THEN "availability"::"availability" END);

ALTER TABLE "cover_letters" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "cover_letters"
  ALTER COLUMN "source" TYPE "cover_letter_source" USING "source"::"cover_letter_source";
ALTER TABLE "cover_letters" ALTER COLUMN "source" SET DEFAULT 'manual';

ALTER TABLE "email_accounts"
  ALTER COLUMN "provider" TYPE "email_provider" USING "provider"::"email_provider";

ALTER TABLE "email_oauth_clients" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "email_oauth_clients"
  ALTER COLUMN "provider" TYPE "email_provider" USING "provider"::"email_provider";
ALTER TABLE "email_oauth_clients" ALTER COLUMN "provider" SET DEFAULT 'gmail';

ALTER TABLE "email_messages" ALTER COLUMN "review_status" DROP DEFAULT;
ALTER TABLE "email_messages"
  ALTER COLUMN "classification" TYPE "email_classification" USING "classification"::"email_classification",
  ALTER COLUMN "review_status" TYPE "email_review_status" USING "review_status"::"email_review_status",
  ALTER COLUMN "applied_status" TYPE "application_status" USING "applied_status"::"application_status";
ALTER TABLE "email_messages" ALTER COLUMN "review_status" SET DEFAULT 'pending';

ALTER TABLE "upwork_proposals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "upwork_proposals" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "upwork_proposals"
  ALTER COLUMN "status" TYPE "upwork_proposal_status" USING "status"::"upwork_proposal_status",
  ALTER COLUMN "outcome" TYPE "upwork_proposal_outcome" USING "outcome"::"upwork_proposal_outcome",
  ALTER COLUMN "source" TYPE "upwork_proposal_source" USING "source"::"upwork_proposal_source";
ALTER TABLE "upwork_proposals" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "upwork_proposals" ALTER COLUMN "source" SET DEFAULT 'manual';

ALTER TABLE "upwork_profiles" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "upwork_profiles"
  ALTER COLUMN "status" TYPE "upwork_profile_status" USING "status"::"upwork_profile_status";
ALTER TABLE "upwork_profiles" ALTER COLUMN "status" SET DEFAULT 'empty';

ALTER TABLE "upwork_inbox_items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "upwork_inbox_items"
  ALTER COLUMN "kind" TYPE "upwork_inbox_kind" USING "kind"::"upwork_inbox_kind",
  ALTER COLUMN "status" TYPE "upwork_inbox_status" USING "status"::"upwork_inbox_status";
ALTER TABLE "upwork_inbox_items" ALTER COLUMN "status" SET DEFAULT 'unread';
