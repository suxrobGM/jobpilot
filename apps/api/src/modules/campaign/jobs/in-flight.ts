import type { Prisma } from "@/generated/prisma/client";
import { canonicalizeJobUrl } from "@/modules/application/job-url";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  findFuzzyDuplicate,
} from "@/modules/scoring/applied-duplicates";

/** Rows already being applied to are the reservation; no separate table is needed. */
export type InFlightReader = Pick<Prisma.TransactionClient, "job">;

export interface InFlightJob {
  campaignId: string;
  key: string;
  url: string;
  title: string;
  company: string;
}

/** Bounds the scan; a profile never has more than a handful of applies open at once. */
const MAX_IN_FLIGHT = 100;

/**
 * A duplicate of this job that another worker is applying to *right now*.
 *
 * The applied-duplicate rule only sees `Application` rows, which are written when a result is
 * recorded - minutes after the claim was granted. Serially that gap is invisible. Run two workers
 * and it is the whole apply: both claim the same posting under two URLs, both see no application,
 * and both submit. That is exactly how GitLab and Alpaca were applied to twice. Treating an
 * `applying` row as a reservation closes the window without a new table.
 */
export async function findInFlightDuplicate(
  db: InFlightReader,
  userId: string,
  job: InFlightJob,
): Promise<InFlightJob | null> {
  const others = await db.job.findMany({
    where: {
      status: "applying",
      campaign: { userId },
      NOT: { campaignId: job.campaignId, key: job.key },
    },
    take: MAX_IN_FLIGHT,
    select: { campaignId: true, key: true, url: true, title: true, company: true },
  });
  if (others.length === 0) {
    return null;
  }

  const canonical = canonicalizeJobUrl(job.url);
  const sameUrl = others.find((other) => canonicalizeJobUrl(other.url) === canonical);
  if (sameUrl) {
    return sameUrl;
  }

  const fuzzy = findFuzzyDuplicate(
    { title: job.title, company: job.company },
    others.map((other) => ({
      id: `${other.campaignId}:${other.key}`,
      url: other.url,
      title: other.title,
      company: other.company,
      appliedAt: new Date(),
    })),
    APPLIED_DUPLICATE_THRESHOLD,
  );
  if (!fuzzy) {
    return null;
  }

  return others.find((other) => `${other.campaignId}:${other.key}` === fuzzy.candidate.id) ?? null;
}
