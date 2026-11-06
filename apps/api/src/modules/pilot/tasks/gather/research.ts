import type { PilotConfig, TaskPayload } from "@jobpilot/contracts/pilot";
import { DAY_MS, HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { latestRun, ranRecently } from "../../runs/run-history";
import { isFeedPaused } from "./feed-paused";

const PERIODIC_MS = 7 * DAY_MS;
const DRY_COOLDOWN_MS = 24 * HOUR_MS;
/** A search this many empty runs in a row is backing off. */
const BACKING_OFF_RUNS = 3;

export type ResearchTask = Omit<TaskPayload<"research.explore">, "newJobsTarget">;
type ResearchTrigger = ResearchTask["trigger"];

interface TriggerInput {
  searchCount: number;
  backingOffCount: number;
  lastRun: Awaited<ReturnType<typeof latestRun>>;
  now: Date;
}

export function researchTrigger(input: TriggerInput): ResearchTrigger | null {
  const { lastRun, now } = input;
  if (lastRun && !lastRun.finishedAt) return null;
  if (!lastRun) return "initial";
  // Zero searches is never dry: `search.setup` comes first then.
  const dry = input.searchCount > 0 && input.backingOffCount * 2 > input.searchCount;
  if (dry && !ranRecently(lastRun, now, DRY_COOLDOWN_MS)) return "dry";
  if (!ranRecently(lastRun, now, PERIODIC_MS)) return "periodic";
  return null;
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

interface ResearchInput {
  goals: string;
  config: PilotConfig;
  trigger: ResearchTrigger;
}

/** Null without a resume to score against. */
export async function researchPayload(
  prisma: PrismaClient,
  userId: string,
  input: ResearchInput,
): Promise<ResearchTask | null> {
  const [resumeId, profile] = await Promise.all([
    researchResumeId(prisma, userId),
    prisma.profile.findUnique({ where: { userId }, select: { requiresSponsorship: true } }),
  ]);
  if (!resumeId) return null;
  return {
    goals: input.goals,
    resumeId,
    minScore: input.config.minScore,
    preferCapExempt: input.config.preferCapExempt,
    requiresSponsorship: profile?.requiresSponsorship ?? false,
    boards: input.config.boards,
    trigger: input.trigger,
  };
}

interface ResearchContext {
  goals: string;
  config: PilotConfig;
  searchCount: number;
}

/** Research the pilot starts on its own: first, when searches run dry, then weekly. */
export async function gatherResearch(
  prisma: PrismaClient,
  userId: string,
  ctx: ResearchContext,
  now: Date,
): Promise<ResearchTask | null> {
  const [lastRun, backingOffCount, paused] = await Promise.all([
    latestRun(prisma, userId, "research.explore"),
    prisma.feed.count({
      where: { userId, kind: "search", archivedAt: null, emptyRuns: { gte: BACKING_OFF_RUNS } },
    }),
    isFeedPaused(prisma, userId, "research"),
  ]);
  if (paused) return null;
  const trigger = researchTrigger({ searchCount: ctx.searchCount, backingOffCount, lastRun, now });
  if (!trigger) return null;
  return researchPayload(prisma, userId, { goals: ctx.goals, config: ctx.config, trigger });
}
