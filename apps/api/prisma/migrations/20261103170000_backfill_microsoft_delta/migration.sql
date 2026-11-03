-- Rebuild delta scopes created with $top so their omitted messages are backfilled.
UPDATE "email_accounts" SET "delta_link" = NULL WHERE "provider" = 'microsoft';
