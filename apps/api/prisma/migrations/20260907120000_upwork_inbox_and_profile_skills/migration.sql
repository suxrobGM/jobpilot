-- The MCP can write the skill set, so JobPilot suggests one alongside the overview.
ALTER TABLE "upwork_profiles" ADD COLUMN "current_skills" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "upwork_profiles" ADD COLUMN "suggested_skills" TEXT NOT NULL DEFAULT '[]';

-- The web cannot reach the MCP, so the agent mirrors the Connects balance here.
CREATE TABLE "upwork_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connects_balance" INTEGER,
    "last_synced_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upwork_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "upwork_accounts_user_id_key" ON "upwork_accounts"("user_id");

ALTER TABLE "upwork_accounts" ADD CONSTRAINT "upwork_accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "upwork_inbox_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "upwork_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_name" TEXT,
    "job_url" TEXT,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "received_at" TIMESTAMP(3) NOT NULL,
    "raw" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upwork_inbox_items_pkey" PRIMARY KEY ("id")
);

-- Upwork's own id keys the upsert, so a repeated sync updates instead of duplicating.
CREATE UNIQUE INDEX "upwork_inbox_items_user_id_upwork_id_key" ON "upwork_inbox_items"("user_id", "upwork_id");
CREATE INDEX "upwork_inbox_items_user_id_kind_received_at_idx" ON "upwork_inbox_items"("user_id", "kind", "received_at");
CREATE INDEX "upwork_inbox_items_user_id_status_idx" ON "upwork_inbox_items"("user_id", "status");

ALTER TABLE "upwork_inbox_items" ADD CONSTRAINT "upwork_inbox_items_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
