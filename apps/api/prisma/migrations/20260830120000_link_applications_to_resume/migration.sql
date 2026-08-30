-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "resume_id" TEXT,
ADD COLUMN     "resume_variant_id" TEXT;

-- CreateIndex
CREATE INDEX "applications_resume_id_idx" ON "applications"("resume_id");

-- CreateIndex
CREATE INDEX "applications_resume_variant_id_idx" ON "applications"("resume_variant_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_variant_id_fkey" FOREIGN KEY ("resume_variant_id") REFERENCES "resume_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: the resume an application went out with was never recorded. The only trace is
-- `resume_variants.application_id`, itself a best-effort job-URL match written at result time, so it
-- exists only where tailoring created a fresh variant. Recover what it does cover; the rest stays
-- null, since a reused variant leaves no record of which application used it.
--
-- Only an unambiguous match: an application with two variants attached stays null rather than have
-- one attributed at random.
UPDATE "applications" a
SET "resume_variant_id" = v."id",
    "resume_id"         = v."resume_id"
FROM "resume_variants" v
WHERE v."application_id" = a."id"
  AND (
    SELECT count(*) FROM "resume_variants" w WHERE w."application_id" = a."id"
  ) = 1;
