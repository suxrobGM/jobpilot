-- Older searches were named with their raw board query; the -exclusions now show as a hint instead.
UPDATE "feeds"
SET "name" = btrim(regexp_replace(regexp_replace("name", '(^|\s)-\S+', ' ', 'g'), '\s+', ' ', 'g'))
WHERE "kind" = 'search'
  AND "name" = "query"
  AND "name" ~ '(^|\s)-\S'
  AND btrim(regexp_replace(regexp_replace("name", '(^|\s)-\S+', ' ', 'g'), '\s+', ' ', 'g')) <> '';

UPDATE "feeds" SET "name" = 'Started in terminal'
WHERE "kind" = 'manual' AND "name" = 'Your own runs';
