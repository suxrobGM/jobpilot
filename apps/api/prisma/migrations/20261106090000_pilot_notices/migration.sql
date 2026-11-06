-- Notices are computed on read; only dismissals and the autopilot start time are stored.
ALTER TABLE "pilot_states"
  ADD COLUMN "dismissed_notices" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "autopilot_since" TIMESTAMPTZ(3);

-- Unknown start times count from now, so `cap.unused` waits a full week after deploy.
UPDATE "pilot_states" SET "autopilot_since" = NOW() WHERE "autopilot";
