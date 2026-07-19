-- Rename the outreach feature to networking. Table, its pkey/indexes/FKs, plus
-- data fixups for the source/config JSON keys that stored the old name as text.

ALTER TABLE "outreach_messages" RENAME TO "networking_messages";
ALTER TABLE "networking_messages" RENAME CONSTRAINT "outreach_messages_pkey" TO "networking_messages_pkey";
ALTER INDEX "outreach_messages_profile_id_idx" RENAME TO "networking_messages_profile_id_idx";
ALTER INDEX "outreach_messages_campaign_id_idx" RENAME TO "networking_messages_campaign_id_idx";
ALTER INDEX "outreach_messages_contact_id_idx" RENAME TO "networking_messages_contact_id_idx";
ALTER INDEX "outreach_messages_thread_id_idx" RENAME TO "networking_messages_thread_id_idx";
ALTER INDEX "outreach_messages_status_idx" RENAME TO "networking_messages_status_idx";
ALTER TABLE "networking_messages" RENAME CONSTRAINT "outreach_messages_profile_id_fkey" TO "networking_messages_profile_id_fkey";
ALTER TABLE "networking_messages" RENAME CONSTRAINT "outreach_messages_contact_id_fkey" TO "networking_messages_contact_id_fkey";
ALTER TABLE "networking_messages" RENAME CONSTRAINT "outreach_messages_campaign_id_fkey" TO "networking_messages_campaign_id_fkey";

UPDATE "campaigns" SET "source" = 'networking' WHERE "source" = 'outreach';
UPDATE "campaigns" SET "config" = replace("config", '"outreach":', '"networking":') WHERE "config" LIKE '%"outreach":%';

UPDATE "pilot_states" SET "instructions_config" = replace(replace(replace(replace(replace(
  "instructions_config",
  '"outreachEnabled":', '"networkingEnabled":'),
  '"dailyOutreachCap":', '"dailyNetworkingCap":'),
  '"outreachFollowupDays":', '"networkingFollowupDays":'),
  '"outreachEmail":', '"networkingEmail":'),
  '"outreachLinkedIn":', '"networkingLinkedIn":');
