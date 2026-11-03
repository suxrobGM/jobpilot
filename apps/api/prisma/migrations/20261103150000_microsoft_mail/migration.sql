CREATE TYPE "email_provider" AS ENUM ('gmail', 'microsoft');
ALTER TABLE "email_accounts"
  ADD COLUMN "provider" "email_provider" NOT NULL DEFAULT 'gmail',
  ADD COLUMN "signed_in_email" TEXT,
  ADD COLUMN "mailbox_id" TEXT,
  ADD COLUMN "delta_link" TEXT;
ALTER TABLE "email_oauth_clients"
  ADD COLUMN "provider" "email_provider" NOT NULL DEFAULT 'gmail',
  ADD COLUMN "tenant_id" TEXT,
  ADD COLUMN "mailbox" TEXT,
  ADD COLUMN "allow_send" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX "email_oauth_clients_user_id_key";
CREATE UNIQUE INDEX "email_oauth_clients_user_id_provider_key" ON "email_oauth_clients"("user_id", "provider");
