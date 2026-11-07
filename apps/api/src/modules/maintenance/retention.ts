import { UNUSED_VARIANT_DAYS } from "@jobpilot/contracts/resume";
import { DAY_MS } from "@/common/date/buckets";
import { type JobStatus, Prisma, type PrismaClient } from "@/generated/prisma/client";
import { SERVER_SKIP_REASONS } from "@/modules/pilot/skip-reasons";
import { notProtectedVariant } from "@/modules/resume/variants/variant.schema";
import { deleteSpentTombstones, QUESTION_TOMBSTONE_SUBJECTS } from "./question-tombstones";

interface RetentionRule {
  name: string;
  days: number;
  /** Deletes or blanks the rows older than `before`; never a row something still reads. */
  apply: (db: PrismaClient, before: Date) => Promise<{ count: number }>;
}

const FOUND: JobStatus[] = ["queued", "pending"];
const DROPPED: JobStatus[] = ["skipped", "failed"];

/** Applied in order, once a day. */
export const RETENTION_RULES = [
  {
    name: "journalEntries",
    days: 30,
    apply: (db, before) =>
      db.pilotJournalEntry.deleteMany({
        where: { createdAt: { lt: before }, kind: { not: "digest" } },
      }),
  },
  {
    name: "digests",
    days: 90,
    apply: (db, before) =>
      db.pilotJournalEntry.deleteMany({ where: { kind: "digest", createdAt: { lt: before } } }),
  },
  // Never shorter than `questions`: a finished run is the only record an answer was acted on.
  {
    name: "runs",
    days: 30,
    apply: (db, before) =>
      db.pilotRun.deleteMany({
        where: { finishedAt: { not: null, lt: before }, taskType: { not: "search.discover" } },
      }),
  },
  // Discovery runs damp a search's cadence, which has no upper bound.
  {
    name: "discoveryRuns",
    days: 90,
    apply: (db, before) =>
      db.pilotRun.deleteMany({
        where: { taskType: "search.discover", finishedAt: { not: null, lt: before } },
      }),
  },
  {
    name: "questions",
    days: 30,
    apply: (db, before) =>
      db.pilotQuestion.deleteMany({
        where: {
          createdAt: { lt: before },
          OR: [
            { status: { in: ["expired", "cancelled"] } },
            { status: "answered", subjectType: { notIn: QUESTION_TOMBSTONE_SUBJECTS } },
            { status: "answered", subjectType: null },
          ],
        },
      }),
  },
  // The answers `questions` keeps, once their review can no longer re-open.
  { name: "spentTombstones", days: 30, apply: deleteSpentTombstones },
  // Grace past expiry or use before a token row goes.
  {
    name: "verificationTokens",
    days: 3,
    apply: (db, before) =>
      db.verificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: before } }, { consumedAt: { lt: before } }] },
      }),
  },
  {
    name: "authTokens",
    days: 3,
    apply: (db, before) =>
      db.authToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }] },
      }),
  },
  // Blanked, not deleted: the inbox and re-sync dedupe need the row. Unscanned mail keeps its body.
  {
    name: "emailBodies",
    days: 60,
    apply: (db, before) =>
      db.emailMessage.updateMany({
        where: { receivedAt: { lt: before }, body: { not: "" }, scannedAt: { not: null } },
        data: { body: "", links: [] },
      }),
  },
  // Past the 14-day mail sync and the 7-day job-alert lookback, so nothing re-imports or reads it.
  {
    name: "irrelevantEmails",
    days: 30,
    apply: (db, before) =>
      db.emailMessage.deleteMany({
        where: { classification: "irrelevant", receivedAt: { lt: before }, applicationId: null },
      }),
  },
  // A live application renders these as its timeline.
  {
    name: "applicationEvents",
    days: 90,
    apply: (db, before) =>
      db.applicationEvent.deleteMany({
        where: {
          createdAt: { lt: before },
          application: { status: { in: ["rejected", "withdrawn"] } },
        },
      }),
  },
  // A linked variant is the record of what was sent; a suggestion still waits on the user.
  {
    name: "resumeVariants",
    days: UNUSED_VARIANT_DAYS,
    apply: (db, before) =>
      db.resumeVariant.deleteMany({
        where: { createdAt: { lt: before }, applicationId: null, ...notProtectedVariant },
      }),
  },
  {
    name: "staleProposals",
    days: 14,
    apply: (db, before) =>
      db.pilotChange.updateMany({
        where: { status: "proposed", createdAt: { lt: before } },
        data: { status: "dismissed", decidedAt: new Date() },
      }),
  },
  // Proposals have no decidedAt, so this never reaches one still waiting.
  {
    name: "decidedChanges",
    days: 90,
    apply: (db, before) => db.pilotChange.deleteMany({ where: { decidedAt: { lt: before } } }),
  },
  {
    name: "requests",
    days: 30,
    apply: (db, before) =>
      db.pilotRequest.deleteMany({ where: { finishedAt: { not: null, lt: before } } }),
  },
  {
    name: "messages",
    days: 90,
    apply: (db, before) => db.pilotMessage.deleteMany({ where: { createdAt: { lt: before } } }),
  },
  // A posting nobody acted on for three weeks has usually closed. A proposal is Upwork work.
  {
    name: "staleFoundJobs",
    days: 21,
    apply: (db, before) =>
      db.job.updateMany({
        where: { status: { in: FOUND }, createdAt: { lt: before }, upworkProposals: { none: {} } },
        data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.wentStale },
      }),
  },
  // A rescan rebuilds an empty brief from the posting; duplicate checks use only the URL.
  {
    name: "droppedJobTexts",
    days: 30,
    apply: (db, before) =>
      db.job.updateMany({
        where: {
          status: { in: DROPPED },
          updatedAt: { lt: before },
          OR: [{ description: { not: null } }, { brief: { not: Prisma.DbNull } }],
        },
        data: { description: null, brief: Prisma.DbNull },
      }),
  },
  {
    name: "droppedJobs",
    days: 180,
    apply: (db, before) =>
      db.job.deleteMany({
        where: {
          status: { in: DROPPED },
          createdAt: { lt: before },
          applications: { none: {} },
          upworkProposals: { none: {} },
        },
      }),
  },
  // After the job rules, which can empty an archived search.
  {
    name: "emptyArchivedSearches",
    days: 7,
    apply: (db, before) =>
      db.feed.deleteMany({
        where: {
          archivedAt: { lt: before },
          jobs: { none: {} },
          applications: { none: {} },
          networkingMessages: { none: {} },
        },
      }),
  },
  // Sources cascade with their listing.
  {
    name: "unseenListings",
    days: 120,
    apply: (db, before) => db.jobListing.deleteMany({ where: { lastSeenAt: { lt: before } } }),
  },
] as const satisfies readonly RetentionRule[];

export type RetentionRuleName = (typeof RETENTION_RULES)[number]["name"];

/** Runs every rule in order; returns how many rows each touched. */
export async function applyRetention(
  db: PrismaClient,
  now: Date,
): Promise<Record<RetentionRuleName, number>> {
  const counts: Partial<Record<RetentionRuleName, number>> = {};
  for (const rule of RETENTION_RULES) {
    const before = new Date(now.getTime() - rule.days * DAY_MS);
    counts[rule.name] = (await rule.apply(db, before)).count;
  }
  return counts as Record<RetentionRuleName, number>;
}
