import { db } from "@/common/database/prisma.client";
import { container } from "@/common/di/container";
import { JobListingPublisher } from "@/modules/job-listing";

const BATCH = 500;

/**
 * Backfill the public index from existing jobs; write-through only sees jobs found after the
 * deploy. Runs the same publisher as the live path, so the two cannot drift. Idempotent -
 * re-running only refreshes.
 */
export async function seedJobListings(): Promise<void> {
  const publisher = container.resolve(JobListingPublisher);
  const counts = { scanned: 0, created: 0, merged: 0, refreshed: 0, skipped: 0, failed: 0 };
  let cursor: string | undefined;

  for (;;) {
    // Oldest first, so firstSeenAt lands on the real first sighting rather than read order.
    const jobs = await db.job.findMany({
      take: BATCH,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        company: true,
        url: true,
        location: true,
        salary: true,
        type: true,
        board: true,
        description: true,
        digest: true,
      },
    });

    if (jobs.length === 0) {
      break;
    }
    cursor = jobs.at(-1)?.id;
    counts.scanned += jobs.length;

    for (const job of jobs) {
      try {
        // Sequential: concurrent upserts of one posting would contend on the same row.
        counts[await publisher.publish(job)]++;
      } catch (error) {
        // One bad row must not abort a backfill of thousands.
        counts.failed++;
        console.warn(`⚠️  Job ${job.id} (${job.url}) failed:`, error);
      }
    }

    console.log(`   …${counts.scanned} job(s) scanned`);
  }

  console.log(
    `✅ Job listings: scanned ${counts.scanned}, published ${counts.created}, ` +
      `merged as repost ${counts.merged}, refreshed ${counts.refreshed}, ` +
      `skipped (no digest) ${counts.skipped}, failed ${counts.failed}.`,
  );
}
