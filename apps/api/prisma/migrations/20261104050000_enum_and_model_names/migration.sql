-- Actors act on more than campaigns; providers are captcha services.
ALTER TYPE "campaign_actor" RENAME TO "actor";
ALTER TYPE "service_provider" RENAME TO "captcha_provider";

-- Every other enum is lowercase. The users.role default follows the renamed value.
ALTER TYPE "user_role" RENAME VALUE 'SUPER_ADMIN' TO 'super_admin';
ALTER TYPE "user_role" RENAME VALUE 'ADMIN' TO 'admin';
ALTER TYPE "user_role" RENAME VALUE 'USER' TO 'user';
ALTER TYPE "verification_token_type" RENAME VALUE 'EMAIL_VERIFICATION' TO 'email_verification';
ALTER TYPE "verification_token_type" RENAME VALUE 'PASSWORD_RESET' TO 'password_reset';
ALTER TYPE "verification_token_type" RENAME VALUE 'EMAIL_CHANGE' TO 'email_change';

-- REFERENCES is reserved in SQL; the table name was a trap in raw queries.
ALTER TABLE "references" RENAME TO "professional_references";
ALTER TABLE "professional_references" RENAME CONSTRAINT "references_pkey" TO "professional_references_pkey";
ALTER TABLE "professional_references" RENAME CONSTRAINT "references_user_id_fkey" TO "professional_references_user_id_fkey";
ALTER INDEX "references_user_id_idx" RENAME TO "professional_references_user_id_idx";

-- When, not just whether. The exact moment of past verifications is unknown, so sign-up time stands in.
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified";
ALTER TABLE "users" DROP COLUMN "email_verified";
