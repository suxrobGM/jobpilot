// Retention windows + where-clause builders. No runtime env/db imports: CI runs `bun test` with neither.

import { UNUSED_VARIANT_DAYS } from "@jobpilot/contracts/resume";
import { DAY_MS } from "@/common/date/buckets";
import type { Prisma } from "@/generated/prisma/client";
import { notProtectedVariant } from "@/modules/resume/variants/variant.schema";

export const RETENTION_DAYS = {
  journal: 30,
  journalDigest: 90,
  // Never shorter than `question`: the finished run is the only record an answered question was consumed.
  run: 30,
  // search.discover runs damp on a user-configurable cadence with no upper bound, so a 14d
  // delete could re-fire a long-cadence saved search early - keep those 90d instead.
  runDiscover: 90,
  question: 30,
  /** Grace past expiry/consumption before a token row is swept. */
  token: 3,
  promotion: 30,
  emailBody: 60,
  applicationEvent: 90,
  // Under the scorer's 180d recency floor, so a swept variant is one it had stopped preferring.
  resumeVariant: UNUSED_VARIANT_DAYS,
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

export function runFinishedWhere(c: RetentionCutoffs): Prisma.PilotRunWhereInput {
  // finishedAt: not null excludes open runs explicitly - never sweep in-flight work.
  return { finishedAt: { not: null, lt: c.run }, taskType: { not: "search.discover" } };
}

export function runDiscoverWhere(c: RetentionCutoffs): Prisma.PilotRunWhereInput {
  return { taskType: "search.discover", finishedAt: { not: null, lt: c.runDiscover } };
}

/** Subjects that stay live indefinitely and whose only re-offer suppressor is the answered question itself. */
const QUESTION_TOMBSTONE_SUBJECTS = ["email", "campaign"];

export function questionTerminalWhere(c: RetentionCutoffs): Prisma.PilotQuestionWhereInput {
  // "open" is deliberately absent - never sweep a question still awaiting an answer.
  return {
    createdAt: { lt: c.question },
    OR: [
      { status: { in: ["expired", "cancelled"] } },
      // Deleting the rest re-opens interview-reply and paused-review work on a still-live subject.
      { status: "answered", subjectType: { notIn: QUESTION_TOMBSTONE_SUBJECTS } },
      { status: "answered", subjectType: null },
    ],
  };
}

export function verificationTokenWhere(c: RetentionCutoffs): Prisma.VerificationTokenWhereInput {
  return { OR: [{ expiresAt: { lt: c.token } }, { consumedAt: { lt: c.token } }] };
}

export function authTokenWhere(c: RetentionCutoffs): Prisma.AuthTokenWhereInput {
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
  // Scanned only: the inbox review queue has no age bound, so an old unscanned message still needs its body.
  // Links go too: the job-alert import reads only a week back.
  return { receivedAt: { lt: c.emailBody }, rawBody: { not: "" }, scannedAt: { not: null } };
}

export function resumeVariantWhere(c: RetentionCutoffs): Prisma.ResumeVariantWhereInput {
  // Unlinked only: a linked variant is the record of what was sent, and the only way to correlate a
  // resume change with an outcome. Reserved labels are excluded - a suggestion is pending review.
  return {
    createdAt: { lt: c.resumeVariant },
    applicationId: null,
    ...notProtectedVariant,
  };
}

export function applicationEventWhere(c: RetentionCutoffs): Prisma.ApplicationEventWhereInput {
  // Closed only: a live application renders these as its timeline, and its interview_prep event blocks re-prep.
  return {
    createdAt: { lt: c.applicationEvent },
    application: { status: { in: ["rejected", "withdrawn"] } },
  };
}
