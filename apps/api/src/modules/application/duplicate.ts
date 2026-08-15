import type { ApplicationStatus } from "@jobpilot/contracts/application";
import type { Prisma } from "@/generated/prisma/client";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  APPLIED_DUPLICATE_WINDOW_DAYS,
  findFuzzyDuplicate,
} from "@/modules/scoring/applied-duplicates";
import { canonicalizeJobUrl } from "./job-url";

/** Enough candidates to cover a heavy month; the fuzzy scan is in-process, so it stays bounded. */
const MAX_FUZZY_CANDIDATES = 1000;

const MATCH_SELECT = {
  id: true,
  url: true,
  title: true,
  company: true,
  appliedAt: true,
  status: true,
} as const;

export type DuplicateReader = Pick<Prisma.TransactionClient, "application">;

export interface DuplicateLookup {
  url?: string;
  title?: string;
  company?: string;
}

export interface DuplicateApplication {
  id: string;
  url: string;
  title: string;
  company: string;
  appliedAt: Date;
  status: ApplicationStatus;
}

export type AppliedDuplicate =
  | { kind: "url"; application: DuplicateApplication }
  | { kind: "fuzzy"; score: number; application: DuplicateApplication };

/**
 * The one duplicate rule: exact URL, else a fuzzy title+company match inside the rolling window.
 * Shared by the advisory `/applied/check` endpoint and the server-side guard that blocks a second
 * apply, so the answer the agent is given and the answer that is enforced cannot drift apart.
 */
export async function findAppliedDuplicate(
  db: DuplicateReader,
  userId: string,
  lookup: DuplicateLookup,
): Promise<AppliedDuplicate | null> {
  if (lookup.url) {
    const exact = await db.application.findUnique({
      where: { userId_url: { userId, url: canonicalizeJobUrl(lookup.url) } },
      select: MATCH_SELECT,
    });
    if (exact) {
      return { kind: "url", application: toDuplicateApplication(exact) };
    }
  }

  if (!lookup.title || !lookup.company) {
    return null;
  }

  const cutoff = new Date(Date.now() - APPLIED_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
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
  return matched
    ? { kind: "fuzzy", score: fuzzy.score, application: toDuplicateApplication(matched) }
    : null;
}

/** The skip reason the apply skills already write, so blocked and self-skipped rows read alike. */
export function duplicateSkipReason(duplicate: AppliedDuplicate): string {
  return `Already applied (${duplicate.kind})`;
}

function toDuplicateApplication(row: {
  id: string;
  url: string;
  title: string;
  company: string;
  appliedAt: Date;
  status: string;
}): DuplicateApplication {
  return { ...row, status: row.status as ApplicationStatus };
}
