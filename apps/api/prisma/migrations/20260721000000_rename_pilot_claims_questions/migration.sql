-- Rename enums
ALTER TYPE "PilotLeaseOutcome" RENAME TO "PilotClaimOutcome";
ALTER TYPE "QuestionKind" RENAME TO "PilotQuestionKind";
ALTER TYPE "QuestionStatus" RENAME TO "PilotQuestionStatus";

-- Rename tables
ALTER TABLE "pilot_leases" RENAME TO "pilot_claims";
ALTER TABLE "questions" RENAME TO "pilot_questions";

-- Rename PK + FK constraints (RENAME CONSTRAINT also renames the backing pkey index)
ALTER TABLE "pilot_claims" RENAME CONSTRAINT "pilot_leases_pkey" TO "pilot_claims_pkey";
ALTER TABLE "pilot_claims" RENAME CONSTRAINT "pilot_leases_user_id_fkey" TO "pilot_claims_user_id_fkey";
ALTER TABLE "pilot_questions" RENAME CONSTRAINT "questions_pkey" TO "pilot_questions_pkey";
ALTER TABLE "pilot_questions" RENAME CONSTRAINT "questions_user_id_fkey" TO "pilot_questions_user_id_fkey";

-- Rename secondary indexes to the names Prisma expects for the new @@map
ALTER INDEX "pilot_leases_user_id_expires_at_idx" RENAME TO "pilot_claims_user_id_expires_at_idx";
ALTER INDEX "pilot_leases_user_id_subject_type_subject_id_idx" RENAME TO "pilot_claims_user_id_subject_type_subject_id_idx";
ALTER INDEX "questions_user_id_status_idx" RENAME TO "pilot_questions_user_id_status_idx";
ALTER INDEX "questions_status_expires_at_idx" RENAME TO "pilot_questions_status_expires_at_idx";
