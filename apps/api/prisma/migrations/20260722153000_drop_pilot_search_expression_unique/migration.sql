-- DropIndex
-- Reverts the previous migration's UNIQUE (user_id, query, COALESCE(board, '')). Prisma cannot model
-- an expression index, so it read as permanent drift from schema.prisma; the (userId, query, board)
-- guard lives in PilotSearchService again.
DROP INDEX IF EXISTS "pilot_searches_user_id_query_board_key";
