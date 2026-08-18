-- The scanner marks a confident classification `auto`, but the server only ever applies `rejected`.
-- An interview invite or offer therefore sat in the Auto tab with no call to action: the application
-- never moved and the funnel reported zero interviews. `auto` now means "the server applied it", so
-- move the parked rows into the queue the user actually works.
--
-- Rows whose application already moved are left alone: `approved` and `denied` are decisions.

UPDATE email_messages
SET review_status = 'pending'
WHERE review_status = 'auto'
  AND coalesce(applied_status, classification) IN ('interviewing', 'offer');
