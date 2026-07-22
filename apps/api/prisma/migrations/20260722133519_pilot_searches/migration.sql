-- CreateTable
CREATE TABLE "pilot_searches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "board" TEXT,
    "resume_id" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "last_run_at" TIMESTAMP(3),
    "last_jobs_seen" INTEGER,
    "last_new_jobs" INTEGER,
    "empty_runs" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilot_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pilot_searches_user_id_next_run_at_idx" ON "pilot_searches"("user_id", "next_run_at");

-- AddForeignKey
ALTER TABLE "pilot_searches" ADD CONSTRAINT "pilot_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: move instructions_config.savedSearches JSON into pilot_searches rows,
-- immediately due so the new demand-driven scheduler picks them up on the next cycle.
INSERT INTO "pilot_searches" ("id", "user_id", "query", "board", "resume_id", "reason", "next_run_at", "created_at", "updated_at")
SELECT gen_random_uuid(), ps."user_id", trim(elem->>'query'), NULLIF(elem->>'board', ''), NULLIF(elem->>'resumeId', ''),
       'Imported from your saved searches', now(), now(), now()
FROM "pilot_states" ps, jsonb_array_elements(ps."instructions_config"->'savedSearches') AS elem
WHERE jsonb_typeof(ps."instructions_config"->'savedSearches') = 'array'
  AND length(trim(COALESCE(elem->>'query', ''))) > 0;

-- The config schema no longer knows savedSearches; drop the dead key rather than shim reads.
UPDATE "pilot_states" SET "instructions_config" = "instructions_config" - 'savedSearches'
WHERE "instructions_config" ? 'savedSearches';

-- Agenda inputs changed shape; stale snapshots must not survive the deploy.
UPDATE "pilot_states" SET "agenda_version" = NULL, "agenda_generated_at" = NULL, "agenda_expires_at" = NULL, "agenda_snapshot" = NULL;
