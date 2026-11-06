import { DAY_MS, minutesOfDay, startOfDay } from "@/common/date/buckets";
import { allNamed } from "@/common/utils";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { WebPushService } from "@/modules/web-push/web-push.service";
import type { PilotJournalService } from "../thread/journal.service";

const DIGEST_HOUR_UTC = 7;

interface DigestDeps {
  prisma: PrismaClient;
  journal: PilotJournalService;
  push: WebPushService;
}

// A type, not an interface: journal `detail` needs the implicit index signature.
type DigestCounts = {
  applicationsCreated: number;
  jobsFailed: number;
  jobsSkipped: number;
  openQuestions: number;
  networkingSent: number;
  networkingReplies: number;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function countLastDay(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const since = new Date(now.getTime() - DAY_MS);
  const jobs = (status: "failed" | "skipped") =>
    tx.job.count({ where: { status, userId, createdAt: { gte: since } } });
  return allNamed({
    applicationsCreated: tx.application.count({ where: { userId, appliedAt: { gte: since } } }),
    jobsFailed: jobs("failed"),
    jobsSkipped: jobs("skipped"),
    networkingSent: tx.networkingMessage.count({ where: { userId, sentAt: { gte: since } } }),
    networkingReplies: tx.networkingMessage.count({ where: { userId, repliedAt: { gte: since } } }),
  });
}

function digestSummary(counts: DigestCounts): string {
  const parts = [
    plural(counts.applicationsCreated, "application", "applications"),
    `${counts.jobsFailed + counts.jobsSkipped} not applied`,
    `${counts.networkingSent} networking sent (${plural(counts.networkingReplies, "reply", "replies")})`,
    plural(counts.openQuestions, "open question", "open questions"),
  ];
  return `Last 24h: ${parts.join(", ")}.`;
}

/**
 * Writes one "digest" journal entry per UTC day, after 07:00, and pushes it. Called fire-and-forget,
 * so it logs its own errors instead of rejecting.
 */
export async function writeDigestIfDue(
  { prisma, journal, push }: DigestDeps,
  userId: string,
  now: Date,
  openQuestions: number,
): Promise<void> {
  if (minutesOfDay(now) < DIGEST_HOUR_UTC * 60) return;
  const todaysDigest = { userId, kind: "digest" as const, createdAt: { gte: startOfDay(now) } };
  try {
    // Unlocked first: every refresh after the digest hour would otherwise open a locking transaction.
    const alreadyWritten = await prisma.pilotJournalEntry.count({ where: todaysDigest });
    if (alreadyWritten > 0) return;
    await prisma.$transaction(async (tx) => {
      // No unique constraint backs once-per-day, so this lock is the only duplicate guard.
      // $executeRaw because the pg adapter can't deserialize the lock's void column.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext('pilot-digest'))`;
      const written = await tx.pilotJournalEntry.count({ where: todaysDigest });
      if (written > 0) return;

      const detail = { ...(await countLastDay(tx, userId, now)), openQuestions };
      const summary = digestSummary(detail);
      await journal.append(userId, { entries: [{ kind: "digest", summary, detail }] });
      void push.sendToUser(userId, {
        title: "Your Pilot's morning digest",
        body: summary,
        url: "/pilot",
        tag: "pilot-digest",
      });
    });
  } catch (err) {
    console.error("[pilot] digest write failed", err);
  }
}
