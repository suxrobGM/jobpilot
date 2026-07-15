-- CreateTable
CREATE TABLE "pilot_states" (
    "profile_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mandate_goals" TEXT NOT NULL DEFAULT '',
    "mandate_config" TEXT NOT NULL DEFAULT '{}',
    "mandate_updated_at" TIMESTAMP(3),
    "last_cycle_at" TIMESTAMP(3),
    "cycle_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilot_states_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "pilot_leases" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeat_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "released_at" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "pilot_leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "subject_type" TEXT,
    "subject_id" TEXT,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL DEFAULT '[]',
    "deep_link" TEXT,
    "answer" TEXT,
    "answered_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilot_journal_entries" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "cycle_id" TEXT,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '{}',
    "subject_type" TEXT,
    "subject_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pilot_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pilot_leases_profile_id_expires_at_idx" ON "pilot_leases"("profile_id", "expires_at");

-- CreateIndex
CREATE INDEX "escalations_profile_id_status_idx" ON "escalations"("profile_id", "status");

-- CreateIndex
CREATE INDEX "pilot_journal_entries_profile_id_created_at_idx" ON "pilot_journal_entries"("profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "pilot_states" ADD CONSTRAINT "pilot_states_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilot_leases" ADD CONSTRAINT "pilot_leases_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pilot_journal_entries" ADD CONSTRAINT "pilot_journal_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
