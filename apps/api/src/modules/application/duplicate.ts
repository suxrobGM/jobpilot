import { DAY_MS } from "@/common/date/buckets";
import type { Prisma } from "@/generated/prisma/client";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  APPLIED_DUPLICATE_WINDOW_DAYS,
  findFuzzyDuplicate,
} from "@/modules/scoring/applied-duplicates";
import { canonicalizeJobUrl } from "./job-url";

/** A heavy month's worth; the fuzzy scan runs in-process, so it has to stay bounded. */
const MAX_FUZZY_CANDIDATES = 1000;

const MATCH_SELECT = {
  id: true,
  url: true,
  title: true,
  company: true,
  appliedAt: true,
  status: true,
} satisfies Prisma.ApplicationSelect;

export type DuplicateReader = Pick<Prisma.TransactionClient, "application">;

export interface DuplicateLookup {
  url?: string;
  title?: string;
  company?: string;
}

type DuplicateApplication = Prisma.ApplicationGetPayload<{ select: typeof MATCH_SELECT }>;

export type AppliedDuplicate =
  | { kind: "url"; application: DuplicateApplication }
  | { kind: "fuzzy"; score: number; application: DuplicateApplication };

/**
 * Exact URL, else fuzzy title+company. Only the fuzzy arm is windowed - it is a similarity score
 * and would otherwise accumulate false positives forever, while an exact url is the same posting
 * however long ago it was. Shared by `/applied/check` and
 * the apply guard so advice and enforcement cannot drift apart.
 */
export async function findAppliedDuplicate(
  db: DuplicateReader,
  userId: string,
  lookup: DuplicateLookup,
): Promise<AppliedDuplicate | null> {
  const cutoff = new Date(Date.now() - APPLIED_DUPLICATE_WINDOW_DAYS * DAY_MS);

  if (lookup.url) {
    const url = canonicalizeJobUrl(lookup.url);
    const exact = await db.application.findUnique({
      where: { userId_url: { userId, url } },
      select: MATCH_SELECT,
    });
    // Deliberately unwindowed, unlike the fuzzy arm below. An exact canonical url is the same
    // posting however long ago it was, and the costs are not symmetric: skipping a genuine repost
    // costs one missed application, while re-applying puts a second one in an employer's inbox and
    // cannot be taken back.
    if (exact) {
      return { kind: "url", application: exact };
    }
  }

  if (!lookup.title || !lookup.company) {
    return null;
  }

  const candidates = await db.application.findMany({
    where: { userId, appliedAt: { gte: cutoff } },
    select: MATCH_SELECT,
    take: MAX_FUZZY_CANDIDATES,
  });

  const fuzzy = findFuzzyDuplicate(
    { title: lookup.title, company: lookup.company },
    candidates,
    APPLIED_DUPLICATE_THRESHOLD,
  );
  if (!fuzzy) {
    return null;
  }

  const matched = candidates.find((c) => c.id === fuzzy.candidate.id);
  return matched ? { kind: "fuzzy", score: fuzzy.score, application: matched } : null;
}

/** The skip reason the apply skills already write, so blocked and self-skipped rows read alike. */
export function duplicateSkipReason(duplicate: AppliedDuplicate): string {
  return `Already applied (${duplicate.kind})`;
}
