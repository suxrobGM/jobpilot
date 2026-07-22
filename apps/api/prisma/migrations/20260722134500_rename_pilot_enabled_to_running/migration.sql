-- Hand-written rename (Prisma diffs this as drop + add, which would lose the values).
ALTER TABLE "pilot_states" RENAME COLUMN "enabled" TO "running";

-- Persisted agenda snapshots embed the old state shape; drop them rather than shim reads.
UPDATE "pilot_states" SET "agenda_version" = NULL, "agenda_generated_at" = NULL, "agenda_expires_at" = NULL, "agenda_snapshot" = NULL;
