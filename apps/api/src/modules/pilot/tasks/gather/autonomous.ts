import type { PilotConfig } from "@jobpilot/contracts/pilot";
import { allNamed } from "@/common/utils";
import { allowedToday } from "../allowed-today";
import { type AutonomousWork, isPipelineQuiet } from "../build";
import type { GatheredCounts } from "./counts";
import { type FeedReviews, gatherFeedReviews } from "./feed-reviews";
import { gatherPausedFeeds, gatherQueueScores, gatherScorePending } from "./feeds";
import type { GatherContext } from "./gather-context";
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

interface AutonomousPilot {
  config: PilotConfig;
  goals: string;
  /** Still in flight, so the signals wave overlaps it. */
  counts: Promise<GatheredCounts>;
}

/** Three waves; each skips the reads that today's config, counts or queue already rule out. */
export async function gatherAutonomousWork(
  ctx: GatherContext,
  pilot: AutonomousPilot,
): Promise<AutonomousWork> {
  const { config, goals } = pilot;
  const [{ searchCount, ...counts }, signals] = await Promise.all([
    pilot.counts,
    allNamed({
      queueScores: gatherQueueScores(ctx, config.minScore),
      pausedFeeds: gatherPausedFeeds(ctx),
      boardDiagnoses: gatherBoardDiagnoses(ctx),
      inbox: gatherInbox(ctx),
      jobAlerts: gatherJobAlerts(ctx, config),
      interviewReplies: gatherInterviewReplies(ctx),
      interviewPreps: gatherInterviewPreps(ctx),
      upworkSync: gatherUpworkSync(ctx),
    }),
  ]);

  const { emailAutonomy, outreach, appliesLeft, sendsLeft } = allowedToday(config, counts);
  const emailOn = emailAutonomy !== null && sendsLeft > 0;
  const introsOn = outreach !== null && sendsLeft > 0;
  // Scoring and discovery only matter once nothing approved is left to apply to.
  const nothingApproved = counts.approvedJobs.length === 0;
  const queue = await allNamed({
    approvedNetworking: emailOn ? gatherApprovedNetworking(ctx) : [],
    followups: emailOn ? gatherFollowups(ctx, config) : [],
    warmIntroCandidates: introsOn ? gatherWarmIntroCandidates(ctx, counts.approvedJobs) : [],
    searches: nothingApproved ? gatherDueSearches(ctx, appliesLeft > 0) : NO_DUE_SEARCHES,
    scorePending: nothingApproved ? gatherScorePending(ctx, config.minScore) : [],
  });
  // A job can sit in both lists; the Set keeps one contacts pass per job.
  await attachWarmContacts(ctx, [
    ...new Set([...counts.approvedJobs, ...queue.warmIntroCandidates]),
  ]);

  const { searches, ...queued } = queue;
  const quiet = isPipelineQuiet({ ...counts, ...signals, ...searches, ...queued });
  // Blank goals need no task: emptyReason "awaitingSetup" already says so.
  const hasGoals = goals !== "";
  const canSetUp = quiet && hasGoals && (searchCount === 0 || appliesLeft > 0);
  const idle = await allNamed({
    reviews: quiet ? gatherFeedReviews(ctx) : NO_REVIEWS,
    setup: canSetUp ? gatherSetup(ctx, { goals, minScore: config.minScore }) : null,
    research: quiet && hasGoals ? gatherResearch(ctx, { goals, config, searchCount }) : null,
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
