// Pure retention windows + where-clause builders for the aggressive cleanup policy. No env/db
// imports here - CI runs `bun test` with no database and no environment. The `Prisma` namespace
// is a type-only import (erased at compile time), so it carries no runtime dependency.
import { DAY_MS } from "@/common/date/buckets";
import type { Prisma } from "@/generated/prisma/client";

export const RETENTION_DAYS = {
  journal: 30,
  journalDigest: 90,
  claim: 14,
  // search.discover claims damp on a user-configurable cadence with no upper bound, so a 14d
  // delete could re-fire a long-cadence saved search early - keep those 90d instead.
  claimDiscover: 90,
  question: 30,
  /** Grace past expiry/consumption before a token row is swept. */
  token: 3,
  promotion: 30,
  emailBody: 60,
  applicationEvent: 90,
} as const;

export type RetentionCutoffs = Record<keyof typeof RETENTION_DAYS, Date>;

/** One cutoff per configured window, so a new rule cannot be given a window and then never swept. */
export function cutoffs(now: Date): RetentionCutoffs {
  const entries = Object.entries(RETENTION_DAYS).map(([rule, days]) => [
    rule,
    new Date(now.getTime() - days * DAY_MS),
  ]);
  return Object.fromEntries(entries) as RetentionCutoffs;
}

export function journalOldWhere(c: RetentionCutoffs): Prisma.PilotJournalEntryWhereInput {
  return { createdAt: { lt: c.journal }, kind: { not: "digest" } };
}

export function journalDigestOldWhere(c: RetentionCutoffs): Prisma.PilotJournalEntryWhereInput {
  return { kind: "digest", createdAt: { lt: c.journalDigest } };
}

export function claimReleasedWhere(c: RetentionCutoffs): Prisma.PilotClaimWhereInput {
  // releasedAt: not null excludes open claims explicitly - never sweep in-flight work.
  return { releasedAt: { not: null, lt: c.claim }, kind: { not: "search.discover" } };
}

export function claimDiscoverWhere(c: RetentionCutoffs): Prisma.PilotClaimWhereInput {
  return { kind: "search.discover", releasedAt: { not: null, lt: c.claimDiscover } };
}

export function questionTerminalWhere(c: RetentionCutoffs): Prisma.PilotQuestionWhereInput {
  // "open" is deliberately absent - never sweep a question still awaiting an answer.
  return { status: { in: ["answered", "expired", "cancelled"] }, createdAt: { lt: c.question } };
}

export function verificationTokenWhere(c: RetentionCutoffs): Prisma.VerificationTokenWhereInput {
  return { OR: [{ expiresAt: { lt: c.token } }, { consumedAt: { lt: c.token } }] };
}

export function refreshTokenWhere(c: RetentionCutoffs): Prisma.RefreshTokenWhereInput {
  return { OR: [{ expiresAt: { lt: c.token } }, { revokedAt: { lt: c.token } }] };
}

export function promotionPostWhere(c: RetentionCutoffs): Prisma.PromotionPostWhereInput {
  return {
    status: { in: ["declined", "skipped", "expired", "failed"] },
    updatedAt: { lt: c.promotion },
  };
}

export function emailBodyWhere(c: RetentionCutoffs): Prisma.EmailMessageWhereInput {
  // Blank, never delete: rawBody powers the inbox dialog (falls back to snippet) and re-sync dedupe.
  return { receivedAt: { lt: c.emailBody }, rawBody: { not: "" } };
}

export function applicationEventWhere(c: RetentionCutoffs): Prisma.ApplicationEventWhereInput {
  return { createdAt: { lt: c.applicationEvent } };
}
