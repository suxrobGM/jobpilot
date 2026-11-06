import { DAY_MS, minutesOfDay, startOfDay } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import type { WebPushService } from "@/modules/web-push/web-push.service";
import type { PilotJournalService } from "../journal.service";

const DIGEST_HOUR_UTC = 7;

interface DigestDeps {
  prisma: PrismaClient;
  journal: PilotJournalService;
  push: WebPushService;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

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

      const since = new Date(now.getTime() - DAY_MS);
      const [
        applicationsCreated,
        jobsFailed,
        jobsSkipped,
        networkingSent,
        networkingReplies,
        promotionsPosted,
      ] = await Promise.all([
        tx.application.count({ where: { userId, appliedAt: { gte: since } } }),
        tx.job.count({
          where: { status: "failed", userId, createdAt: { gte: since } },
        }),
        tx.job.count({
          where: { status: "skipped", userId, createdAt: { gte: since } },
        }),
        tx.networkingMessage.count({ where: { userId, sentAt: { gte: since } } }),
        tx.networkingMessage.count({ where: { userId, repliedAt: { gte: since } } }),
        tx.promotionPost.count({ where: { userId, status: "posted", postedAt: { gte: since } } }),
      ]);

      const summary = `Last 24h: ${[
        plural(applicationsCreated, "application", "applications"),
        `${jobsFailed + jobsSkipped} not applied`,
        `${networkingSent} networking sent (${plural(networkingReplies, "reply", "replies")})`,
        `${plural(promotionsPosted, "post", "posts")} published`,
        plural(openQuestions, "open question", "open questions"),
      ].join(", ")}.`;
      const detail = {
        applicationsCreated,
        jobsFailed,
        jobsSkipped,
        openQuestions,
        networkingSent,
        networkingReplies,
        promotionsPosted,
      };
      await journal.appendJournal(userId, { entries: [{ kind: "digest", summary, detail }] });
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
