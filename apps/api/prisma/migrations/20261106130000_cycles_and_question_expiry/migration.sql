-- Hosts report cycles to POST /api/pilot/cycles; the journal keeps only what runs did.
DELETE FROM "pilot_journal_entries" WHERE "kind" = 'cycle';
ALTER TYPE "pilot_journal_kind" RENAME TO "pilot_journal_kind_old";
CREATE TYPE "pilot_journal_kind" AS ENUM ('action', 'question', 'system', 'digest', 'correction');
ALTER TABLE "pilot_journal_entries"
  ALTER COLUMN "kind" TYPE "pilot_journal_kind" USING "kind"::text::"pilot_journal_kind";
DROP TYPE "pilot_journal_kind_old";

-- Every question expires. Open ones get two weeks from now rather than lapsing on the next sweep.
UPDATE "pilot_questions" SET "expires_at" = now() + interval '14 days'
WHERE "expires_at" IS NULL AND "status" = 'open';
UPDATE "pilot_questions" SET "expires_at" = "created_at" + interval '14 days'
WHERE "expires_at" IS NULL;
ALTER TABLE "pilot_questions" ALTER COLUMN "expires_at" SET NOT NULL;
