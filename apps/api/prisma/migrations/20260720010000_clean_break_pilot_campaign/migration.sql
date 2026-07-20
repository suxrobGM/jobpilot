-- Validate all values before the first schema mutation.
DO $$
BEGIN
  PERFORM config::jsonb FROM campaigns;
  PERFORM instructions_config::jsonb FROM pilot_states;
  PERFORM payload::jsonb FROM pilot_leases;
  PERFORM options::jsonb FROM questions;
  PERFORM detail::jsonb FROM pilot_journal_entries;

  IF EXISTS (SELECT 1 FROM campaigns WHERE jsonb_typeof(config::jsonb) <> 'object') THEN
    RAISE EXCEPTION 'campaigns.config must contain JSON objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pilot_states WHERE jsonb_typeof(instructions_config::jsonb) <> 'object') THEN
    RAISE EXCEPTION 'pilot_states.instructions_config must contain JSON objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pilot_leases WHERE jsonb_typeof(payload::jsonb) <> 'object') THEN
    RAISE EXCEPTION 'pilot_leases.payload must contain JSON objects';
  END IF;
  IF EXISTS (SELECT 1 FROM questions WHERE jsonb_typeof(options::jsonb) <> 'array') THEN
    RAISE EXCEPTION 'questions.options must contain JSON arrays';
  END IF;
  IF EXISTS (SELECT 1 FROM pilot_journal_entries WHERE jsonb_typeof(detail::jsonb) <> 'object') THEN
    RAISE EXCEPTION 'pilot_journal_entries.detail must contain JSON objects';
  END IF;

  IF EXISTS (SELECT 1 FROM campaigns WHERE source NOT IN ('search', 'auto-apply', 'apply', 'networking')) THEN
    RAISE EXCEPTION 'campaigns.source contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM campaigns WHERE status NOT IN ('in_progress', 'paused', 'interrupted', 'completed', 'failed')) THEN
    RAISE EXCEPTION 'campaigns.status contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM jobs WHERE status NOT IN ('pending', 'approved', 'applying', 'applied', 'failed', 'skipped', 'needs_user')) THEN
    RAISE EXCEPTION 'jobs.status contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM pilot_leases WHERE outcome IS NOT NULL AND outcome NOT IN ('done', 'failed', 'abandoned', 'expired')) THEN
    RAISE EXCEPTION 'pilot_leases.outcome contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM questions WHERE kind NOT IN ('question', 'choice', '2fa', 'approval')) THEN
    RAISE EXCEPTION 'questions.kind contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM questions WHERE status NOT IN ('open', 'answered', 'expired', 'cancelled')) THEN
    RAISE EXCEPTION 'questions.status contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM pilot_journal_entries WHERE kind NOT IN ('cycle', 'action', 'observation', 'question', 'system', 'digest', 'correction')) THEN
    RAISE EXCEPTION 'pilot_journal_entries.kind contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM promotion_posts WHERE status NOT IN ('draft', 'approved', 'declined', 'posted', 'failed', 'skipped', 'expired')) THEN
    RAISE EXCEPTION 'promotion_posts.status contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM contacts WHERE email_source IS NOT NULL AND email_source NOT IN ('guessed', 'verified', 'provided')) THEN
    RAISE EXCEPTION 'contacts.email_source contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM contacts WHERE linkedin_connection NOT IN ('none', 'pending', 'connected')) THEN
    RAISE EXCEPTION 'contacts.linkedin_connection contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM contacts WHERE discovery_source IS NOT NULL AND discovery_source NOT IN ('google', 'company-site', 'web', 'linkedin', 'manual')) THEN
    RAISE EXCEPTION 'contacts.discovery_source contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM networking_messages WHERE channel NOT IN ('email', 'linkedin')) THEN
    RAISE EXCEPTION 'networking_messages.channel contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM networking_messages WHERE linkedin_kind IS NOT NULL AND linkedin_kind NOT IN ('inmail', 'connect_note', 'dm')) THEN
    RAISE EXCEPTION 'networking_messages.linkedin_kind contains an unsupported value';
  END IF;
  IF EXISTS (SELECT 1 FROM networking_messages WHERE status NOT IN ('draft', 'approved', 'sent', 'replied', 'bounced', 'failed', 'skipped')) THEN
    RAISE EXCEPTION 'networking_messages.status contains an unsupported value';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pilot_leases
    WHERE released_at IS NULL
    GROUP BY user_id, subject_type, subject_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate active pilot leases must be resolved before migration';
  END IF;
END $$;

CREATE TYPE "CampaignSource" AS ENUM ('search', 'auto-apply', 'apply', 'networking');
CREATE TYPE "CampaignStatus" AS ENUM ('in_progress', 'paused', 'completed', 'failed');
CREATE TYPE "CampaignJobStatus" AS ENUM ('pending', 'approved', 'applying', 'applied', 'failed', 'skipped', 'needs_user');
CREATE TYPE "PilotLeaseOutcome" AS ENUM ('done', 'failed', 'abandoned', 'expired');
CREATE TYPE "QuestionKind" AS ENUM ('question', 'choice', '2fa', 'approval');
CREATE TYPE "QuestionStatus" AS ENUM ('open', 'answered', 'expired', 'cancelled');
CREATE TYPE "PilotJournalKind" AS ENUM ('cycle', 'action', 'observation', 'question', 'system', 'digest', 'correction');
CREATE TYPE "PromotionStatus" AS ENUM ('draft', 'approved', 'declined', 'posted', 'failed', 'skipped', 'expired');
CREATE TYPE "NetworkingChannel" AS ENUM ('email', 'linkedin');
CREATE TYPE "LinkedinMessageKind" AS ENUM ('inmail', 'connect_note', 'dm');
CREATE TYPE "NetworkingMessageStatus" AS ENUM ('draft', 'approved', 'sent', 'replied', 'bounced', 'failed', 'skipped');
CREATE TYPE "ContactEmailSource" AS ENUM ('guessed', 'verified', 'provided');
CREATE TYPE "ContactLinkedinConnection" AS ENUM ('none', 'pending', 'connected');
CREATE TYPE "ContactDiscoverySource" AS ENUM ('google', 'company-site', 'web', 'linkedin', 'manual');

CREATE TEMP TABLE campaign_id_cutover (
  old_id text PRIMARY KEY,
  new_id text NOT NULL UNIQUE
) ON COMMIT DROP;
INSERT INTO campaign_id_cutover(old_id, new_id)
SELECT campaign_id, gen_random_uuid()::text FROM campaigns;

-- Campaign foreign keys use ON UPDATE CASCADE. Update the few intentional string references too.
UPDATE campaigns AS campaign
SET campaign_id = ids.new_id
FROM campaign_id_cutover AS ids
WHERE campaign.campaign_id = ids.old_id;
UPDATE upwork_proposals AS proposal
SET campaign_id = ids.new_id
FROM campaign_id_cutover AS ids
WHERE proposal.campaign_id = ids.old_id;
UPDATE pilot_leases AS lease
SET payload = jsonb_set(lease.payload::jsonb, '{campaignId}', to_jsonb(ids.new_id))::text
FROM campaign_id_cutover AS ids
WHERE lease.payload::jsonb ->> 'campaignId' = ids.old_id;
UPDATE pilot_leases AS lease
SET subject_id = CASE
  WHEN lease.subject_id = ids.old_id THEN ids.new_id
  ELSE ids.new_id || substring(lease.subject_id FROM length(ids.old_id) + 1)
END
FROM campaign_id_cutover AS ids
WHERE lease.subject_id = ids.old_id OR lease.subject_id LIKE ids.old_id || ':%';
UPDATE questions AS question
SET subject_id = CASE
  WHEN question.subject_id = ids.old_id THEN ids.new_id
  ELSE ids.new_id || substring(question.subject_id FROM length(ids.old_id) + 1)
END
FROM campaign_id_cutover AS ids
WHERE question.subject_id = ids.old_id OR question.subject_id LIKE ids.old_id || ':%';
UPDATE pilot_journal_entries AS entry
SET subject_id = ids.new_id
FROM campaign_id_cutover AS ids
WHERE entry.subject_type = 'campaign' AND entry.subject_id = ids.old_id;

UPDATE campaigns SET status = 'paused' WHERE status = 'interrupted';

ALTER TABLE campaigns ALTER COLUMN source TYPE "CampaignSource" USING source::"CampaignSource";
ALTER TABLE campaigns ALTER COLUMN status DROP DEFAULT;
ALTER TABLE campaigns ALTER COLUMN status TYPE "CampaignStatus" USING status::"CampaignStatus";
ALTER TABLE campaigns ALTER COLUMN status SET DEFAULT 'in_progress';
ALTER TABLE campaigns ALTER COLUMN config TYPE jsonb USING config::jsonb;
ALTER TABLE campaigns ALTER COLUMN config SET DEFAULT '{}'::jsonb;
ALTER TABLE campaigns ALTER COLUMN campaign_id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE campaigns DROP COLUMN summary;

DROP TABLE campaign_events;

ALTER TABLE jobs ALTER COLUMN status DROP DEFAULT;
ALTER TABLE jobs ALTER COLUMN status TYPE "CampaignJobStatus" USING status::"CampaignJobStatus";
ALTER TABLE jobs ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE jobs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE pilot_states ALTER COLUMN instructions_config TYPE jsonb USING instructions_config::jsonb;
ALTER TABLE pilot_states ALTER COLUMN instructions_config SET DEFAULT '{}'::jsonb;
ALTER TABLE pilot_states ADD COLUMN agenda_version text;
ALTER TABLE pilot_states ADD COLUMN agenda_generated_at timestamptz;
ALTER TABLE pilot_states ADD COLUMN agenda_expires_at timestamptz;
ALTER TABLE pilot_states ADD COLUMN agenda_snapshot jsonb;

ALTER TABLE pilot_leases ALTER COLUMN payload TYPE jsonb USING payload::jsonb;
ALTER TABLE pilot_leases ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
ALTER TABLE pilot_leases ALTER COLUMN outcome TYPE "PilotLeaseOutcome" USING outcome::"PilotLeaseOutcome";

ALTER TABLE questions ALTER COLUMN kind TYPE "QuestionKind" USING kind::"QuestionKind";
ALTER TABLE questions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE questions ALTER COLUMN status TYPE "QuestionStatus" USING status::"QuestionStatus";
ALTER TABLE questions ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE questions ALTER COLUMN options TYPE jsonb USING options::jsonb;
ALTER TABLE questions ALTER COLUMN options SET DEFAULT '[]'::jsonb;

ALTER TABLE pilot_journal_entries ALTER COLUMN kind TYPE "PilotJournalKind" USING kind::"PilotJournalKind";
ALTER TABLE pilot_journal_entries ALTER COLUMN detail TYPE jsonb USING detail::jsonb;
ALTER TABLE pilot_journal_entries ALTER COLUMN detail SET DEFAULT '{}'::jsonb;

ALTER TABLE promotion_posts ALTER COLUMN status DROP DEFAULT;
ALTER TABLE promotion_posts ALTER COLUMN status TYPE "PromotionStatus" USING status::"PromotionStatus";
ALTER TABLE promotion_posts ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE contacts ALTER COLUMN email_source TYPE "ContactEmailSource" USING email_source::"ContactEmailSource";
ALTER TABLE contacts ALTER COLUMN linkedin_connection DROP DEFAULT;
ALTER TABLE contacts ALTER COLUMN linkedin_connection TYPE "ContactLinkedinConnection" USING linkedin_connection::"ContactLinkedinConnection";
ALTER TABLE contacts ALTER COLUMN linkedin_connection SET DEFAULT 'none';
ALTER TABLE contacts ALTER COLUMN discovery_source TYPE "ContactDiscoverySource" USING discovery_source::"ContactDiscoverySource";

ALTER TABLE networking_messages ALTER COLUMN channel TYPE "NetworkingChannel" USING channel::"NetworkingChannel";
ALTER TABLE networking_messages ALTER COLUMN linkedin_kind TYPE "LinkedinMessageKind" USING linkedin_kind::"LinkedinMessageKind";
ALTER TABLE networking_messages ALTER COLUMN status DROP DEFAULT;
ALTER TABLE networking_messages ALTER COLUMN status TYPE "NetworkingMessageStatus" USING status::"NetworkingMessageStatus";
ALTER TABLE networking_messages ALTER COLUMN status SET DEFAULT 'draft';

DROP INDEX IF EXISTS campaigns_user_id_idx;
CREATE INDEX campaigns_user_id_started_at_idx ON campaigns(user_id, started_at);
CREATE INDEX campaigns_user_id_status_started_at_idx ON campaigns(user_id, status, started_at);
CREATE INDEX campaigns_user_id_source_started_at_idx ON campaigns(user_id, source, started_at);
CREATE INDEX jobs_status_updated_at_idx ON jobs(status, updated_at);
CREATE INDEX pilot_leases_user_id_subject_type_subject_id_idx ON pilot_leases(user_id, subject_type, subject_id);
CREATE UNIQUE INDEX pilot_leases_active_subject_unique
  ON pilot_leases(user_id, subject_type, subject_id)
  WHERE released_at IS NULL;
CREATE INDEX questions_status_expires_at_idx ON questions(status, expires_at);
DROP INDEX IF EXISTS networking_messages_user_id_idx;
DROP INDEX IF EXISTS networking_messages_campaign_id_idx;
DROP INDEX IF EXISTS networking_messages_status_idx;
CREATE INDEX networking_messages_user_id_created_at_idx ON networking_messages(user_id, created_at);
CREATE INDEX networking_messages_campaign_id_status_idx ON networking_messages(campaign_id, status);
CREATE INDEX networking_messages_user_id_status_sent_at_idx ON networking_messages(user_id, status, sent_at);
