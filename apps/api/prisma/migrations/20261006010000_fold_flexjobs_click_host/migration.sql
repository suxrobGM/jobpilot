-- FlexJobs alert emails link through click.mg.flexjobs.com, the same posting the writer now stores
-- under flexjobs.com. Fold existing rows so the exact-URL duplicate arm sees them.
--
-- A row whose folded URL is already taken stays put: that pair was really submitted twice, and
-- rewriting it would break the unique index.
UPDATE "applications" AS a
SET "url" = 'https://flexjobs.com' || substring(a."url" FROM '^https://click\.mg\.flexjobs\.com(.*)$')
WHERE a."url" LIKE 'https://click.mg.flexjobs.com%'
  AND NOT EXISTS (
    SELECT 1 FROM "applications" AS taken
    WHERE taken."user_id" = a."user_id"
      AND taken."url" = 'https://flexjobs.com'
        || substring(a."url" FROM '^https://click\.mg\.flexjobs\.com(.*)$')
  );
