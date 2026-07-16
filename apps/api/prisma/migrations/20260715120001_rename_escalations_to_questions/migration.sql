ALTER TABLE "escalations" RENAME TO "questions";
ALTER TABLE "questions" RENAME COLUMN "question" TO "prompt";
ALTER TABLE "questions" RENAME CONSTRAINT "escalations_pkey" TO "questions_pkey";
ALTER TABLE "questions" RENAME CONSTRAINT "escalations_profile_id_fkey" TO "questions_profile_id_fkey";
ALTER INDEX "escalations_profile_id_status_idx" RENAME TO "questions_profile_id_status_idx";
UPDATE "pilot_journal_entries" SET "kind" = 'question' WHERE "kind" = 'escalation';
UPDATE "pilot_journal_entries" SET "subject_type" = 'question' WHERE "subject_type" = 'escalation';
UPDATE "pilot_leases" SET "subject_type" = 'question' WHERE "subject_type" = 'escalation';
UPDATE "pilot_journal_entries" SET "detail" = replace("detail", '"openEscalations"', '"openQuestions"') WHERE "kind" = 'digest';
