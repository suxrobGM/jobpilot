import type { PilotConfig } from "@jobpilot/contracts/pilot";
import { allNamed } from "@/common/utils";
import type { PrismaClient } from "@/generated/prisma/client";
import { allowedToday } from "../allowed-today";
import { type AutonomousWork, isPipelineQuiet } from "../build";
import type { GatheredCounts } from "./counts";
import { type FeedReviews, gatherFeedReviews } from "./feed-reviews";
import { gatherPausedFeeds, gatherQueueScores, gatherScorePending } from "./feeds";
import { gatherInbox, gatherUpworkSync } from "./inbox";
import { gatherInterviewPreps, gatherInterviewReplies } from "./interviews";
import { gatherJobAlerts } from "./job-alerts";
import { attachWarmContacts, gatherBoardDiagnoses, gatherWarmIntroCandidates } from "./jobs";
import { gatherApprovedNetworking, gatherFollowups } from "./outreach";
import { gatherResearch } from "./research";
import { gatherDueSearches, gatherSetup } from "./searches";

const NO_REVIEWS: FeedReviews = { feedTunes: [], rescanSkipped: [], retryFailed: [] };
const NO_DUE_SEARCHES = { dueQueries: [], nextSearchRunAt: null };

export const NO_AUTONOMOUS_WORK: AutonomousWork = {
  ...NO_REVIEWS,
  ...NO_DUE_SEARCHES,
  warmIntroCandidates: [],
  scorePending: [],
  queueScores: [],
  pausedFeeds: [],
  boardDiagnoses: [],
  inbox: { messageIds: [], count: 0 },
  jobAlerts: null,
  interviewReplies: [],
  interviewPreps: [],
  upworkSync: null,
  approvedNetworking: [],
  followups: [],
  setup: null,
  research: null,
};

interface AutonomousContext {
  config: PilotConfig;
  goals: string;
  /** Still in flight, so the signals wave overlaps it. */
  counts: Promise<GatheredCounts>;
  now: Date;
}

/** Three waves; each skips the reads that today's config, counts or queue already rule out. */
export async function gatherAutonomousWork(
  prisma: PrismaClient,
  userId: string,
  ctx: AutonomousContext,
): Promise<AutonomousWork> {
  const { config, goals, now } = ctx;
  const [{ searchCount, ...counts }, signals] = await Promise.all([
    ctx.counts,
    allNamed({
      queueScores: gatherQueueScores(prisma, userId, config.minScore, now),
      pausedFeeds: gatherPausedFeeds(prisma, userId, now),
      boardDiagnoses: gatherBoardDiagnoses(prisma, userId, now),
      inbox: gatherInbox(prisma, userId),
      jobAlerts: gatherJobAlerts(prisma, userId, config, now),
      interviewReplies: gatherInterviewReplies(prisma, userId),
      interviewPreps: gatherInterviewPreps(prisma, userId),
      upworkSync: gatherUpworkSync(prisma, userId, now),
    }),
  ]);

  const { emailAutonomy, outreach, appliesLeft, sendsLeft } = allowedToday(config, counts);
  const emailOn = emailAutonomy !== null && sendsLeft > 0;
  const introsOn = outreach !== null && sendsLeft > 0;
  // Scoring and discovery only matter once nothing approved is left to apply to.
  const nothingApproved = counts.approvedJobs.length === 0;
  const queue = await allNamed({
    approvedNetworking: emailOn ? gatherApprovedNetworking(prisma, userId) : [],
    followups: emailOn ? gatherFollowups(prisma, userId, config, now) : [],
    warmIntroCandidates: introsOn
      ? gatherWarmIntroCandidates(prisma, userId, now, counts.approvedJobs)
      : [],
    searches: nothingApproved
      ? gatherDueSearches(prisma, userId, now, appliesLeft > 0)
      : NO_DUE_SEARCHES,
    scorePending: nothingApproved ? gatherScorePending(prisma, userId, config.minScore, now) : [],
  });
  // A job can sit in both lists; the Set keeps one contacts pass per job.
  await attachWarmContacts(prisma, userId, [
    ...new Set([...counts.approvedJobs, ...queue.warmIntroCandidates]),
  ]);

  const { searches, ...queued } = queue;
  const quiet = isPipelineQuiet({ ...counts, ...signals, ...searches, ...queued });
  // Blank goals need no task: emptyReason "awaitingSetup" already says so.
  const hasGoals = goals !== "";
  const canSetUp = quiet && hasGoals && (searchCount === 0 || appliesLeft > 0);
  const idle = await allNamed({
    reviews: quiet ? gatherFeedReviews(prisma, userId, now) : NO_REVIEWS,
    setup: canSetUp ? gatherSetup(prisma, userId, { goals, minScore: config.minScore }, now) : null,
    research:
      quiet && hasGoals
        ? gatherResearch(prisma, userId, { goals, config, searchCount }, now)
        : null,
  });

  return {
    ...signals,
    ...searches,
    ...queued,
    ...idle.reviews,
    setup: idle.setup,
    research: idle.research,
  };
}
