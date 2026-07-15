-- CreateTable
CREATE TABLE "promotion_posts" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "target" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "posted_url" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_posts_profile_id_status_idx" ON "promotion_posts"("profile_id", "status");

-- AddForeignKey
ALTER TABLE "promotion_posts" ADD CONSTRAINT "promotion_posts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
