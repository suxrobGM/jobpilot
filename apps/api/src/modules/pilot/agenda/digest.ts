import type { PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import { DAY_MS } from "@/common/date/buckets";
import type { PushService } from "@/common/push";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PilotService } from "../pilot.service";
import { minutesOfDay, startOfDayInTz } from "../pilot.time";

/** The morning digest is composed once the tz-local clock passes this hour. */
const DIGEST_HOUR = 7;

/** Deps for writing the digest journal entry and pushing its summary. */
interface DigestDeps {
  prisma: PrismaClient;
  pilot: PilotService;
  push: PushService;
}

interface DigestCounts {
  applicationsCreated: number;
  jobsFailed: number;
  jobsSkipped: number;
  openQuestions: number;
  networkingSent: number;
  networkingReplies: number;
  promotionsPosted: number;
}

/** Compact human sentence over the last-24h counts; also the push body (kept short). */
function composeDigestSummary(c: DigestCounts): string {
  const parts = [
    `${c.applicationsCreated} application${c.applicationsCreated === 1 ? "" : "s"}`,
    `${c.jobsFailed + c.jobsSkipped} not applied`,
    `${c.networkingSent} networking sent (${c.networkingReplies} repl${c.networkingReplies === 1 ? "y" : "ies"})`,
    `${c.promotionsPosted} post${c.promotionsPosted === 1 ? "" : "s"} published`,
    `${c.openQuestions} open question${c.openQuestions === 1 ? "" : "s"}`,
  ];
  return `Last 24h: ${parts.join(", ")}.`;
}

/**
 * Compose one "digest" journal entry summarizing the last 24h, once per tz-day after 07:00 local.
 * An advisory xact lock serializes concurrent compiles so the count-then-write can't double-fire.
 * Fire-and-forget at the call site, so it swallows its own errors and never rejects.
 */
export async function writeDigestIfDue(
  { prisma, pilot, push }: DigestDeps,
  profileId: string,
  now: Date,
  config: PilotInstructionsConfig,
  openQuestions: number,
): Promise<void> {
  try {
    const tz = config.activeHours?.tz;
    if (minutesOfDay(now, tz) < DIGEST_HOUR * 60) return;

    const dayStart = startOfDayInTz(now, tz);
    // No unique constraint backs the once-per-day rule; the lock is the only duplicate guard.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profileId}), hashtext('pilot-digest'))`;
      const alreadyWritten = await tx.pilotJournalEntry.count({
        where: { profileId, kind: "digest", createdAt: { gte: dayStart } },
      });
      if (alreadyWritten > 0) return;

      const windowStart = new Date(now.getTime() - DAY_MS);
      const [
        applicationsCreated,
        jobsFailed,
        jobsSkipped,
        networkingSent,
        networkingReplies,
        promotionsPosted,
      ] = await Promise.all([
        tx.application.count({ where: { profileId, appliedAt: { gte: windowStart } } }),
        tx.job.count({
          where: { status: "failed", campaign: { profileId }, createdAt: { gte: windowStart } },
        }),
        tx.job.count({
          where: { status: "skipped", campaign: { profileId }, createdAt: { gte: windowStart } },
        }),
        tx.networkingMessage.count({ where: { profileId, sentAt: { gte: windowStart } } }),
        tx.networkingMessage.count({ where: { profileId, repliedAt: { gte: windowStart } } }),
        tx.promotionPost.count({
          where: { profileId, status: "posted", postedAt: { gte: windowStart } },
        }),
      ]);

      const counts: DigestCounts = {
        applicationsCreated,
        jobsFailed,
        jobsSkipped,
        openQuestions,
        networkingSent,
        networkingReplies,
        promotionsPosted,
      };
      const summary = composeDigestSummary(counts);
      // Reuse the journal write path so SSE fires; then push the glanceable summary to the phone.
      await pilot.appendJournal(profileId, {
        entries: [{ kind: "digest", summary, detail: { ...counts } as Record<string, unknown> }],
      });
      void push.sendToProfile(profileId, {
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
