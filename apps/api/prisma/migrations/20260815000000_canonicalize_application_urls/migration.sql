-- Fold existing URLs onto the canonical form the writer now produces for every board: https, no
-- `www.`, lower-case host, no trailing slash. Rows predating it sit beside their own twin, so the
-- exact-URL duplicate arm misses them.
--
-- Tracking params and param order are left alone: the SQL costs far more than the handful of legacy
-- rows carrying them, and an uncanonical row only misses that arm - the fuzzy arm still catches it.
--
-- A row whose canonical URL is already taken stays put: that pair is a duplicate really submitted
-- twice, and rewriting would break the unique index or erase an application that happened.

WITH split AS (
  SELECT
    id,
    user_id,
    url,
    regexp_replace(lower((regexp_match(url, '^https?://([^/?#]+)'))[1]), '^www\.', '') AS bare_host,
    substring(url FROM '^https?://[^/?#]*(.*)$') AS rest
  FROM applications
  WHERE url ~* '^https?://[^/?#]'
), canon AS (
  SELECT
    id,
    user_id,
    url,
    'https://'
      -- The one alias the code carries: hiring.cafe also answers as hiringcafe.com, same paths.
      || CASE WHEN bare_host = 'hiring.cafe' THEN 'hiringcafe.com' ELSE bare_host END
      || CASE
           WHEN rest = '' THEN '/'
           ELSE regexp_replace(rest, '^(/[^?#]*[^/?#])/(\?|#|$)', '\1\2')
         END AS new_url
  FROM split
), rewritable AS (
  -- One winner per target: two legacy rows can fold onto the same URL, and updating both would
  -- break the unique index mid-statement rather than leaving the loser where it is.
  SELECT DISTINCT ON (user_id, new_url) id, user_id, new_url
  FROM canon
  WHERE new_url <> url
  ORDER BY user_id, new_url, id
)
UPDATE applications a
SET url = r.new_url
FROM rewritable r
WHERE a.id = r.id
  AND NOT EXISTS (
    SELECT 1 FROM applications d WHERE d.user_id = r.user_id AND d.url = r.new_url
  );
