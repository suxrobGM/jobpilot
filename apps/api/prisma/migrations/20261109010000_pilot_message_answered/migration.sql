-- A user message counts as answered once a chat.reply run finishes after it. History keeps the old
-- rule (any later pilot message answered it), so nothing already past is replied to again.
ALTER TABLE "pilot_messages" ADD COLUMN "answered_at" TIMESTAMPTZ(3);

UPDATE "pilot_messages" AS u
SET "answered_at" = (
  SELECT min(p."created_at")
  FROM "pilot_messages" AS p
  WHERE p."user_id" = u."user_id" AND p."author" = 'pilot' AND p."created_at" > u."created_at"
)
WHERE u."author" = 'user';
