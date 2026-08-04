import type { AgendaItem } from "@jobpilot/contracts/pilot";
import {
  MAX_BOARD_HEALTH,
  MAX_RESCAN_SKIPPED,
  MAX_RETRY_FAILED,
  MAX_STRATEGY_REVIEWS,
  PRIORITY,
} from "./constants";
import type {
  AgendaBoardHealth,
  AgendaQueueDrain,
  AgendaRescanSkipped,
  AgendaRetryFailed,
  AgendaStrategyBootstrap,
  AgendaStrategyReview,
} from "./types";

/** One batch item per campaign holding pasted links; ranked just below job.apply. */
export function buildQueueDrainItems(campaigns: AgendaQueueDrain[]): AgendaItem[] {
  return campaigns.map((c) => ({
    id: `queue.drain:${c.campaignId}`,
    kind: "queue.drain",
    priority: PRIORITY.queueDrain,
    title: `Score ${c.queuedCount} pasted link(s)`,
    subjectType: "campaign",
    subjectId: c.campaignId,
    payload: {
      campaignId: c.campaignId,
      resumeId: c.resumeId,
      minScore: c.minScore,
      queuedCount: c.queuedCount,
      entries: c.entries,
    },
  }));
}

/** At most one board-health warning per agenda, most-failed board first (pre-sorted by the gather). */
export function buildBoardHealthItems(boards: AgendaBoardHealth[]): AgendaItem[] {
  return boards.slice(0, MAX_BOARD_HEALTH).map((b) => ({
    id: `board.health:${b.board}`,
    kind: "board.health",
    priority: PRIORITY.boardHealth,
    title: `Board failing: ${b.board} (${b.consecutiveFailures})`.slice(0, 200),
    subjectType: "board",
    subjectId: b.board,
    payload: {
      board: b.board,
      consecutiveFailures: b.consecutiveFailures,
      recentFailReasons: b.recentFailReasons,
      probeJob: b.probeJob,
    },
  }));
}

/** At most one strategy review per agenda for a poorly-converting campaign. */
export function buildStrategyReviewItems(reviews: AgendaStrategyReview[]): AgendaItem[] {
  return reviews.slice(0, MAX_STRATEGY_REVIEWS).map((r) => ({
    id: `campaign.strategyReview:${r.campaignId}`,
    kind: "campaign.strategyReview",
    priority: PRIORITY.strategyReview,
    title: `Review strategy: ${r.query}`.slice(0, 200),
    subjectType: "campaign",
    subjectId: r.campaignId,
    payload: {
      campaignId: r.campaignId,
      query: r.query,
      config: { minScore: r.minScore, board: r.board },
      counts: r.counts,
      topSkipReasons: r.topSkipReasons,
    },
  }));
}

/** At most one skipped-jobs rescan sweep per agenda. */
export function buildRescanSkippedItems(rescans: AgendaRescanSkipped[]): AgendaItem[] {
  return rescans.slice(0, MAX_RESCAN_SKIPPED).map((r) => ({
    id: `job.rescanSkipped:${r.campaignId}`,
    kind: "job.rescanSkipped",
    priority: PRIORITY.rescanSkipped,
    title: `Rescan ${r.skippedCount} skipped job(s)`,
    subjectType: "campaign",
    subjectId: r.campaignId,
    payload: { campaignId: r.campaignId, skippedCount: r.skippedCount },
  }));
}

/** One self-setup item: derive searches from the (always-present) goals. Gated by gatherBootstrap. */
export function buildBootstrapItem(bootstrap: AgendaStrategyBootstrap | null): AgendaItem[] {
  if (!bootstrap) return [];
  return [
    {
      id: "strategy.bootstrap",
      kind: "strategy.bootstrap",
      priority: PRIORITY.strategyBootstrap,
      title: "Set up searches from your goals",
      subjectType: "pilot",
      subjectId: "bootstrap",
      payload: {
        goals: bootstrap.goals,
        minScore: bootstrap.minScore,
      },
    },
  ];
}

/** At most one failed-jobs retry sweep per agenda. */
export function buildRetryFailedItems(retries: AgendaRetryFailed[]): AgendaItem[] {
  return retries.slice(0, MAX_RETRY_FAILED).map((r) => ({
    id: `job.retryFailed:${r.campaignId}`,
    kind: "job.retryFailed",
    priority: PRIORITY.retryFailed,
    title: `Retry ${r.failedCount} failed job(s)`,
    subjectType: "campaign",
    subjectId: r.campaignId,
    payload: { campaignId: r.campaignId, failedCount: r.failedCount },
  }));
}
