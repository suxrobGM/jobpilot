import { allNamed } from "@/common/utils";
import type { PrismaClient } from "@/generated/prisma/client";
import { countAppliedToday, countSentToday } from "../../pilot.stats";
import type { TaskCounts } from "../build";
import { gatherApprovedJobs } from "./jobs";
import { gatherAnsweredQuestions } from "./questions";

interface GatheredCounts extends TaskCounts {
  searchCount: number;
}

/** The reads every refresh makes, autopilot or not. */
export function gatherCounts(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<GatheredCounts> {
  return allNamed({
    openQuestions: prisma.pilotQuestion.count({ where: { userId, status: "open" } }),
    activeRuns: prisma.pilotRun.count({
      where: { userId, finishedAt: null, expiresAt: { gt: now } },
    }),
    searchCount: prisma.feed.count({ where: { userId, kind: "search", archivedAt: null } }),
    appliedToday: countAppliedToday(prisma, userId, now),
    networkingSentToday: countSentToday(prisma, userId, now),
    answeredQuestions: gatherAnsweredQuestions(prisma, userId),
    approvedJobs: gatherApprovedJobs(prisma, userId),
  });
}
