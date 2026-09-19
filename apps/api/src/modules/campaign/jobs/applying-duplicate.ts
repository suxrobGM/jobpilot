import type { Prisma } from "@/generated/prisma/client";
import { canonicalizeJobUrl } from "@/modules/application/job-url";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  findFuzzyDuplicate,
} from "@/modules/scoring/applied-duplicates";

export type JobReader = Pick<Prisma.TransactionClient, "job">;

export interface JobPosting {
  campaignId: string;
  key: string;
  url: string;
  title: string;
  company: string;
}

/** A profile never has more than a handful of applies open at once. */
const MAX_APPLYING = 100;

/**
 * An `applying` sibling of the same posting. `Application` rows land only when the result is
 * recorded, so until then the applied-duplicate rule cannot see an apply in progress.
 */
export async function findApplyingDuplicate(
  db: JobReader,
  userId: string,
  job: JobPosting,
): Promise<JobPosting | null> {
  const others = await db.job.findMany({
    where: {
      status: "applying",
      campaign: { userId },
      NOT: { campaignId: job.campaignId, key: job.key },
    },
    take: MAX_APPLYING,
    select: { campaignId: true, key: true, url: true, title: true, company: true },
  });

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
