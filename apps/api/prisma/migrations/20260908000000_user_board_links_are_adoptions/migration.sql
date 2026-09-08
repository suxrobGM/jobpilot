-- A link is now a bare adoption of a catalog board. Name, search URL, and ordering come from the
-- catalog row; logins live in "credentials" keyed by domain (moved beforehand by the
-- board-logins seeder, which must run before this migration).

-- A user-added (unlisted) board edited through its single link keeps that edit on the catalog row.
UPDATE "job_boards" b
SET "name" = COALESCE(l."name", b."name"),
    "search_url" = COALESCE(l."search_url", b."search_url")
FROM "user_job_boards" l
WHERE l."job_board_id" = b."id"
  AND b."listed" = false
  AND (l."name" IS NOT NULL OR l."search_url" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "user_job_boards" o WHERE o."job_board_id" = b."id" AND o."id" <> l."id"
  );

ALTER TABLE "user_job_boards"
  DROP COLUMN "name",
  DROP COLUMN "search_url",
  DROP COLUMN "sort_order",
  DROP COLUMN "email",
  DROP COLUMN "password";
