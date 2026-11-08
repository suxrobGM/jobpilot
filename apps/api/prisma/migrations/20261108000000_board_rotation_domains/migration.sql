-- Saved rotations kept raw strings: hiring.cafe from before the catalog moved to hiringcafe.com
-- (20261027000000), URLs, and board names from an older format. Resolve each the way boardDomain
-- does to a linked board's domain, in order, once; a board the user hasn't linked can't be searched.
UPDATE "pilot_states" s
SET "config" = jsonb_set(s."config", '{boards}', COALESCE((
  SELECT jsonb_agg(resolved."domain" ORDER BY resolved."position")
  FROM (
    SELECT b."domain", MIN(entry."position") AS "position"
    FROM jsonb_array_elements_text(s."config" -> 'boards') WITH ORDINALITY AS entry("value", "position")
    CROSS JOIN LATERAL (
      SELECT regexp_replace(
        split_part(regexp_replace(lower(trim(entry."value")), '^[a-z]+://', ''), '/', 1),
        '^www\.', ''
      ) AS "host"
    ) parsed
    JOIN "job_boards" b
      ON b."domain" = CASE parsed."host" WHEN 'hiring.cafe' THEN 'hiringcafe.com' ELSE parsed."host" END
      OR lower(b."name") = lower(trim(entry."value"))
    JOIN "user_job_boards" u ON u."board_id" = b."id" AND u."user_id" = s."user_id"
    GROUP BY b."domain"
  ) resolved
), '[]'::jsonb))
WHERE jsonb_typeof(s."config" -> 'boards') = 'array';
