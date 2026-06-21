-- AlterTable
ALTER TABLE "auto_apply_settings" ALTER COLUMN "min_match_score" SET DEFAULT 60;

-- CreateTable
CREATE TABLE "email_oauth_client" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_oauth_client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_oauth_client_profile_id_key" ON "email_oauth_client"("profile_id");

-- AddForeignKey
ALTER TABLE "email_oauth_client" ADD CONSTRAINT "email_oauth_client_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
