-- hiring.cafe began serving the same postings from hiringcafe.com with byte-identical paths, so
-- the unique (user_id, url) pair saw one posting as two rows and let a second real application go
-- out. Fold the legacy host onto the canonical one so those rows dedupe against new applications.
--
-- Rows whose canonical URL is already taken are left on the legacy host on purpose: that pair is a
-- duplicate that really was submitted twice, and rewriting would either break the unique index or
-- destroy the record of an application that actually happened.

UPDATE applications a
SET url = 'https://hiringcafe.com/' || substring(a.url FROM length('https://hiring.cafe/') + 1)
WHERE a.url LIKE 'https://hiring.cafe/%'
  AND NOT EXISTS (
    SELECT 1
    FROM applications b
    WHERE b.user_id = a.user_id
      AND b.url = 'https://hiringcafe.com/' || substring(a.url FROM length('https://hiring.cafe/') + 1)
  );

UPDATE applications a
SET url = 'https://hiringcafe.com/' || substring(a.url FROM length('https://www.hiringcafe.com/') + 1)
WHERE a.url LIKE 'https://www.hiringcafe.com/%'
  AND NOT EXISTS (
    SELECT 1
    FROM applications b
    WHERE b.user_id = a.user_id
      AND b.url =
        'https://hiringcafe.com/' || substring(a.url FROM length('https://www.hiringcafe.com/') + 1)
  );
