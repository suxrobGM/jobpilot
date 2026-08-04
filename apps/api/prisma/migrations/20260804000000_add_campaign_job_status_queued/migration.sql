-- Split out: Postgres cannot use an enum value added in the same transaction.
ALTER TYPE "CampaignJobStatus" ADD VALUE 'queued' BEFORE 'pending';
