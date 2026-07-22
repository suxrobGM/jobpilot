-- The savedSearches import could not dedupe, so collapse any duplicate before the index can exist.
-- (created_at, id) is the tiebreaker: the import stamped every row with the same now().
DELETE FROM "pilot_searches" a
USING "pilot_searches" b
WHERE a."user_id" = b."user_id"
  AND a."query" = b."query"
  AND COALESCE(a."board", '') = COALESCE(b."board", '')
  AND (a."created_at", a."id") > (b."created_at", b."id");

-- CreateIndex
-- Uniqueness the service used to pre-check with its own SELECT, which two concurrent creates could
-- both pass. A plain unique index cannot express it - NULL boards compare distinct - so key on
-- COALESCE(board, ''). Prisma cannot model an expression index, so a future `migrate dev` will offer
-- to drop this: keep it.
CREATE UNIQUE INDEX "pilot_searches_user_id_query_board_key" ON "pilot_searches"("user_id", "query", COALESCE("board", ''));
