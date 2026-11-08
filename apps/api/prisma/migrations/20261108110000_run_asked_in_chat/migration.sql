ALTER TABLE "pilot_runs" ADD COLUMN "asked_in_chat" BOOLEAN NOT NULL DEFAULT false;
-- A chat reply always answers in chat; open ones get the flag the close path now reads.
UPDATE "pilot_runs" SET "asked_in_chat" = true WHERE "task_type" = 'chat.reply';
