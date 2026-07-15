import type { PilotMandateConfig } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PilotService } from "./pilot.service";
import { minutesOfDay, startOfDayInTz } from "./pilot.time";
import type { PushService } from "./push.service";

const DAY_MS = 24 * 60 * 60 * 1000;
/** The morning digest is composed once the tz-local clock passes this hour. */
const DIGEST_HOUR = 7;

/** Deps for writing the digest journal entry and pushing its summary. */
export interface DigestDeps {
  prisma: PrismaClient;
  pilot: PilotService;
  push: PushService;
}

interface DigestCounts {
  applicationsCreated: number;
  jobsFailed: number;
  jobsSkipped: number;
  openEscalations: number;
  outreachSent: number;
  outreachReplies: number;
  promotionsPosted: number;
}

/** Compact human sentence over the last-24h counts; also the push body (kept short). */
function composeDigestSummary(c: DigestCounts): string {
  const parts = [
    `${c.applicationsCreated} application${c.applicationsCreated === 1 ? "" : "s"}`,
    `${c.jobsFailed + c.jobsSkipped} not applied`,
    `${c.outreachSent} outreach sent (${c.outreachReplies} repl${c.outreachReplies === 1 ? "y" : "ies"})`,
    `${c.promotionsPosted} post${c.promotionsPosted === 1 ? "" : "s"} published`,
    `${c.openEscalations} open question${c.openEscalations === 1 ? "" : "s"}`,
  ];
  return `Last 24h: ${parts.join(", ")}.`;
}

/**
 * Compose one "digest" journal entry summarizing the last 24h, once per tz-day after
 * 07:00 local. Guarded by a single indexed count so the common path is one cheap query.
 */
export async function writeDigestIfDue(
  { prisma, pilot, push }: DigestDeps,
  profileId: string,
  now: Date,
  config: PilotMandateConfig,
  openEscalations: number,
): Promise<void> {
  const tz = config.activeHours?.tz;
  if (minutesOfDay(now, tz) < DIGEST_HOUR * 60) return;

  const dayStart = startOfDayInTz(now, tz);
  const alreadyWritten = await prisma.pilotJournalEntry.count({
    where: { profileId, kind: "digest", createdAt: { gte: dayStart } },
  });
  if (alreadyWritten > 0) return;

  const windowStart = new Date(now.getTime() - DAY_MS);
  const [
    applicationsCreated,
    jobsFailed,
    jobsSkipped,
    outreachSent,
    outreachReplies,
    promotionsPosted,
  ] = await Promise.all([
    prisma.application.count({ where: { profileId, appliedAt: { gte: windowStart } } }),
    prisma.job.count({
      where: { status: "failed", campaign: { profileId }, createdAt: { gte: windowStart } },
    }),
    prisma.job.count({
      where: { status: "skipped", campaign: { profileId }, createdAt: { gte: windowStart } },
    }),
    prisma.outreachMessage.count({ where: { profileId, sentAt: { gte: windowStart } } }),
    prisma.outreachMessage.count({ where: { profileId, repliedAt: { gte: windowStart } } }),
    prisma.promotionPost.count({
      where: { profileId, status: "posted", postedAt: { gte: windowStart } },
    }),
  ]);

  const counts: DigestCounts = {
    applicationsCreated,
    jobsFailed,
    jobsSkipped,
    openEscalations,
    outreachSent,
    outreachReplies,
    promotionsPosted,
  };
  const summary = composeDigestSummary(counts);
  // Reuse the journal write path so SSE fires; then push the glanceable summary to the phone.
  await pilot.appendJournal(profileId, {
    entries: [{ kind: "digest", summary, detail: { ...counts } as Record<string, unknown> }],
  });
  void push.sendToProfile(profileId, {
    title: "Your Pilot's morning digest",
    body: summary.slice(0, 120),
    url: "/pilot",
    tag: "pilot-digest",
  });
}
