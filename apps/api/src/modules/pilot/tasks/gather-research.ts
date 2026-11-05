import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { isFeedPaused } from "../feeds";
import { hasPendingRunNow, latestRun, ranRecently } from "./run-history";

const PERIODIC_MS = 7 * DAY_MS;
const DRY_COOLDOWN_MS = 24 * HOUR_MS;
/** A search this many empty runs in a row is backing off. */
const BACKING_OFF_RUNS = 3;

export type ResearchTask = Omit<TaskPayload<"research.explore">, "newJobsTarget">;

interface TriggerInput {
  searchCount: number;
  backingOffCount: number;
  lastRun: Awaited<ReturnType<typeof latestRun>>;
  requestedAt: Date | null;
  now: Date;
}

export function researchTrigger(input: TriggerInput): ResearchTask["trigger"] | null {
  const { lastRun, now } = input;
  if (lastRun && !lastRun.finishedAt) return null;
  if (hasPendingRunNow(input.requestedAt, lastRun, now)) return "requested";
  if (!lastRun) return "initial";
  // Zero searches is never dry: `search.setup` comes first then.
  const dry = input.searchCount > 0 && input.backingOffCount * 2 > input.searchCount;
  if (dry && !ranRecently(lastRun, now, DRY_COOLDOWN_MS)) return "dry";
  if (!ranRecently(lastRun, now, PERIODIC_MS)) return "periodic";
  return null;
}

interface ResearchContext extends Omit<ResearchTask, "resumeId" | "trigger"> {
  requestedAt: Date | null;
  searchCount: number;
}

/** The primary resume, or the only one; research can't score against an ambiguous choice. */
async function researchResumeId(prisma: PrismaClient, userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { primaryResumeId: true },
  });
  if (user?.primaryResumeId) return user.primaryResumeId;
  const resumes = await prisma.resume.findMany({
    where: { userId },
    take: 2,
    select: { id: true },
  });
  return resumes.length === 1 ? resumes[0].id : null;
}

export async function gatherResearch(
  prisma: PrismaClient,
  userId: string,
  ctx: ResearchContext,
  now: Date,
): Promise<ResearchTask | null> {
  const { requestedAt, searchCount, ...fields } = ctx;
  const [lastRun, backingOffCount, paused] = await Promise.all([
    latestRun(prisma, userId, "research.explore"),
    prisma.pilotSearch.count({ where: { userId, emptyRuns: { gte: BACKING_OFF_RUNS } } }),
    isFeedPaused(prisma, userId, "research"),
  ]);
  if (paused) return null;
  const trigger = researchTrigger({ searchCount, backingOffCount, lastRun, requestedAt, now });
  if (!trigger) return null;

  const resumeId = await researchResumeId(prisma, userId);
  if (!resumeId) return null;
  return { ...fields, resumeId, trigger };
}
