CREATE TYPE "cap_exempt_basis" AS ENUM ('university', 'university_affiliate', 'nonprofit_research', 'government_research');

ALTER TABLE "campaign_jobs" ADD COLUMN "cap_exempt_basis" "cap_exempt_basis",
ADD COLUMN "cap_exempt_evidence_url" TEXT;

ALTER TABLE "profiles" ADD COLUMN "prefer_cap_exempt" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "pilot_states" ADD COLUMN "research_requested_at" TIMESTAMPTZ(3);
