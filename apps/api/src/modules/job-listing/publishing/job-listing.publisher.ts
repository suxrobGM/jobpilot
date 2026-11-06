import { inject, injectable } from "@needle-di/core";
import { isPrismaError, PRISMA_ERRORS } from "@/common/errors";
import { logger } from "@/common/logger";
import { PrismaClient } from "@/generated/prisma/client";
import { buildListingDraft, type ListingDraft, type ListingSourceJob } from "./listing-draft";

/** What a publish did. The seed reports on these; the write-through callers ignore them. */
export type PublishOutcome = "created" | "merged" | "refreshed" | "skipped";

/** Publishing is fire-and-forget, so nothing throttles it - without a ceiling a burst of job writes
 *  would let background work monopolize the pool and stall the request handlers sharing it. */
const MAX_CONCURRENT = 4;

/** Past this the producer is hopelessly ahead; drop rather than grow the queue without bound. */
const MAX_QUEUED = 500;

/** Publishes a `Job` to the public job index, deduped across every user's feeds. */
@injectable()
export class JobListingPublisher {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** A listing is a derived artifact, so a failure here must never fail the agent's job write. */
  publishInBackground(job: ListingSourceJob): void {
    if (this.waiting.length >= MAX_QUEUED) {
      // Recoverable: the next scrape of the same posting publishes it.
      logger.warn({ url: job.url }, "job-listing publish queue full, dropping");
      return;
    }
    void this.publish(job).catch((error) => {
      logger.error({ err: error, url: job.url }, "job-listing publish failed");
    });
  }

  /** A job too thin to publish drafts to null and costs nothing - callers need not pre-filter. */
  async publish(job: ListingSourceJob): Promise<PublishOutcome> {
    const draft = buildListingDraft(job);
    if (!draft) {
      return "skipped";
    }

    const release = await this.acquire();
    try {
      return await this.upsert(draft);
    } finally {
      release();
    }
  }

  /** Queues rather than throwing: background work has no caller to tell to back off. */
  private async acquire(): Promise<() => void> {
    if (this.active >= MAX_CONCURRENT) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.active--;
      this.waiting.shift()?.();
    };
  }

  /**
   * Identity is URL-first, then match key: a known url is the stronger signal, and going by the key
   * first would fork an orphan listing whenever a re-scrape reworded the title.
   *
   * No interactive transaction: at READ COMMITTED it never made the read-then-write atomic anyway,
   * and it held a pooled connection across every round-trip. The unique constraints are what make
   * concurrent agents converge - so let them, and retry the insert that loses the race.
   */
  private async upsert(draft: ListingDraft, retry = true): Promise<PublishOutcome> {
    const now = new Date();
    const { boardId, url, ...listing } = draft;
    const source = { boardId, url, lastSeenAt: now };

    try {
      const seen = await this.prisma.jobListingSource.findUnique({
        where: { url },
        select: { listingId: true },
      });

      if (seen) {
        await this.prisma.jobListingSource.update({
          where: { url },
          data: { lastSeenAt: now, ...(boardId && { boardId }) },
        });
        await this.prisma.jobListing.update({
          where: { id: seen.listingId },
          data: { lastSeenAt: now, ...enrich(draft) },
        });
        return "refreshed";
      }

      const existing = await this.prisma.jobListing.findUnique({
        where: { matchKey: draft.matchKey },
        select: { id: true },
      });

      // One statement each, so Prisma commits the listing and its source together.
      if (existing) {
        await this.prisma.jobListing.update({
          where: { id: existing.id },
          data: { lastSeenAt: now, ...enrich(draft), sources: { create: source } },
        });
        return "merged";
      }

      await this.prisma.jobListing.create({
        data: { ...listing, firstSeenAt: now, lastSeenAt: now, sources: { create: source } },
      });
      return "created";
    } catch (error) {
      // Another agent inserted this posting mid-flight; re-running now takes the merge branch.
      if (retry && isPrismaError(error, PRISMA_ERRORS.UNIQUE_VIOLATION)) {
        return this.upsert(draft, false);
      }
      throw error;
    }
  }
}

/** Only non-empty values, so a later thinner scrape can enrich a listing but never blank it out. */
function enrich(draft: ListingDraft) {
  return {
    ...(draft.location && { location: draft.location }),
    ...(draft.salary && { salary: draft.salary }),
    ...(draft.employmentType && { employmentType: draft.employmentType }),
    ...(draft.descriptionExcerpt && { descriptionExcerpt: draft.descriptionExcerpt }),
    ...(draft.skills.length > 0 && { skills: draft.skills }),
    ...(draft.requirements.length > 0 && { requirements: draft.requirements }),
    ...(draft.responsibilities.length > 0 && { responsibilities: draft.responsibilities }),
    ...(draft.yearsExperience !== null && { yearsExperience: draft.yearsExperience }),
    ...(draft.remote && { remote: true }),
  };
}
