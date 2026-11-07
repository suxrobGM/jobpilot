import { allNamed } from "@/common/utils";
import { countAppliedToday, countSentToday } from "../../pilot.stats";
import type { TaskCounts } from "../build";
import type { GatherContext } from "./gather-context";
import { gatherApprovedJobs } from "./jobs";
import { gatherAnsweredQuestions } from "./questions";

export interface GatheredCounts extends TaskCounts {
  searchCount: number;
}

/** The reads every refresh makes, autopilot or not. */
export function gatherCounts(ctx: GatherContext): Promise<GatheredCounts> {
  const { prisma, userId, now } = ctx;
  return allNamed({
    openQuestions: prisma.pilotQuestion.count({ where: { userId, status: "open" } }),
    activeRuns: prisma.pilotRun.count({
      where: { userId, finishedAt: null, expiresAt: { gt: now } },
    }),
    searchCount: prisma.feed.count({ where: { userId, kind: "search", archivedAt: null } }),
    appliedToday: countAppliedToday(prisma, userId, now),
    networkingSentToday: countSentToday(prisma, userId, now),
    answeredQuestions: gatherAnsweredQuestions(ctx),
    approvedJobs: gatherApprovedJobs(ctx),
  });
}
