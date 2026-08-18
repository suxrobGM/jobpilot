-- AlterTable
ALTER TABLE "cover_letters" ADD COLUMN     "application_id" TEXT;

-- CreateIndex
CREATE INDEX "cover_letters_application_id_idx" ON "cover_letters"("application_id");

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: the letter is written before the Application row exists, so it only ever carried
-- the job URL and the detail page had no way to show what went out. Same back-link the resume
-- variant already gets on a terminal job result.
--
-- Only an unambiguous match: two letters for one URL both stay unlinked rather than have one
-- attributed at random.
UPDATE "cover_letters" c
SET "application_id" = a."id"
FROM "applications" a
WHERE c."job_url" IS NOT NULL
  AND a."url" = c."job_url"
  AND a."user_id" = c."user_id";
