-- `normalized_title` / `normalized_company` were written on every application and read by nothing:
-- matching normalizes in-process, so the stored copy only ever drifted from the current normalizer.
DROP INDEX "applications_normalized_title_normalized_company_idx";

ALTER TABLE "applications" DROP COLUMN "normalized_title";
ALTER TABLE "applications" DROP COLUMN "normalized_company";

-- The duplicate scan filters (user_id, applied_at >= cutoff). On the user_id index alone Postgres
-- walked every application the account ever created and filtered the window off the heap.
CREATE INDEX "applications_user_id_applied_at_idx" ON "applications"("user_id", "applied_at");

-- Redundant: the composite above answers a bare user_id lookup from its leading column.
DROP INDEX "applications_user_id_idx";
