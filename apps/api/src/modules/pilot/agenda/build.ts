import {
  type AgendaContent,
  type AgendaItem,
  channelAutonomy,
  networkingMode,
} from "@jobpilot/contracts/pilot";
import { nextDayReset } from "@/common/date/buckets";
import {
  ACTIVE_SLEEP_SECONDS,
  MAX_IDLE_SLEEP_SECONDS,
  MAX_ITEMS,
  MIN_IDLE_SLEEP_SECONDS,
  NEW_JOBS_TARGET_MAX,
  NEW_JOBS_TARGET_MIN,
} from "./constants";
import { buildInterviewPrepItems, buildInterviewReplyItems } from "./items-interview";
import {
  buildDiscoverItems,
  buildJobApplyItems,
  buildQuestionItems,
  buildReviewPausedItems,
  buildScorePendingItems,
  buildWarmIntroItems,
} from "./items-jobs";
import { buildFollowupItems, buildInboxItem, buildNetworkingSendItems } from "./items-networking";
import {
  buildBoardHealthItems,
  buildBootstrapItem,
  buildQueueDrainItems,
  buildRescanSkippedItems,
  buildRetryFailedItems,
  buildStrategyReviewItems,
} from "./items-proactive";
import { buildPromoComposeItems, buildPromoPostItems } from "./items-promo";
import type { AgendaInput } from "./types";

/**
 * Name why the agenda is empty so clients render it instead of re-deriving suppression rules.
 * Awaiting setup + empty means bootstrap was gathered but suppressed (recent attempt), otherwise
 * it would be an item.
 */
function agendaEmptyReason(
  itemCount: number,
  capReached: boolean,
  awaitingSetup: boolean,
): AgendaContent["emptyReason"] {
  if (itemCount > 0) return null;
  if (capReached) return "capReached";
  if (awaitingSetup) return "awaitingSetup";
  return "clear";
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Compile a prioritized agenda from already-fetched inputs. Pure: no I/O, so the ordering,
 * cap-suppression, budget, and sleep rules are unit-testable. Ranking lives in PRIORITY
 * (./constants).
 */
export function buildAgenda(input: AgendaInput): AgendaContent {
  const { now, config } = input;
  const capReached = input.appliedToday >= config.dailyApplyCap;
  // The networking cap is independent of the apply cap; it gates sends and followups alike.
  const sendsLeftToday = Math.max(0, config.networking.dailyCap - input.networkingSentToday);
  const outreach = networkingMode(config);
  const emailAutonomy = channelAutonomy(config, "email");

  const items: AgendaItem[] = [...buildQuestionItems(input.answeredQuestions)];
  if (!capReached) items.push(...buildJobApplyItems(input.approvedJobs));
  // Board health outranks apply work: a failing board should be probed before more attempts pile on.
  items.push(...buildBoardHealthItems(input.boardHealth));
  // Ungated by cap/busy: a stranded paused campaign must surface regardless.
  items.push(...buildReviewPausedItems(input.pausedCampaigns));
  items.push(...buildInterviewReplyItems(input.interviewReplies));
  items.push(...buildInterviewPrepItems(input.interviewPreps));
  // User-pasted links are proactive apply work, ranked just under the scored apply queue.
  items.push(...buildQueueDrainItems(input.queueDrains));
  if (outreach)
    items.push(...buildWarmIntroItems(input.warmIntroCandidates, outreach, sendsLeftToday));
  // A send acts on an email draft, so the email channel gates it.
  const sendItems = emailAutonomy
    ? buildNetworkingSendItems(input.approvedNetworking, sendsLeftToday)
    : [];
  items.push(...sendItems);
  items.push(...buildInboxItem(input.inbox));
  items.push(...buildPromoPostItems(input.approvedPromotions));

  // Scoring an existing campaign's pending rows and fresh discovery both only matter when there is
  // nothing approved left to apply to; scoring ranks first so found-but-unscored work finishes first.
  if (input.approvedJobs.length === 0) {
    items.push(...buildScorePendingItems(input.scorePending));

    // Discovery targets the room left under the daily apply cap; the clamp keeps one run bounded.
    const newJobsTarget = clamp(
      config.dailyApplyCap - input.appliedToday,
      NEW_JOBS_TARGET_MIN,
      NEW_JOBS_TARGET_MAX,
    );
    items.push(...buildDiscoverItems(input.dueQueries, config, newJobsTarget, input.cycleCount));
  }

  // Followups spend the same send budget, so they only get what the sends left over.
  const followupsLeftToday = sendsLeftToday - sendItems.length;
  if (followupsLeftToday > 0 && emailAutonomy)
    items.push(...buildFollowupItems(input.followups.slice(0, followupsLeftToday), emailAutonomy));
  items.push(...buildPromoComposeItems(input.duePlatforms));

  // Quiet-agenda maintenance surfaces only when no apply / discover / queue work is queued.
  const busy = items.some(
    (i) =>
      i.kind === "job.apply" ||
      i.kind === "search.discover" ||
      i.kind === "campaign.scorePending" ||
      i.kind === "queue.drain",
  );

  if (!busy) {
    items.push(...buildBootstrapItem(input.bootstrap));
    items.push(...buildStrategyReviewItems(input.strategyReviews));
    items.push(...buildRescanSkippedItems(input.rescanSkipped));
    items.push(...buildRetryFailedItems(input.retryFailed));
  }

  items.sort((a, b) => b.priority - a.priority);
  const capped = items.slice(0, MAX_ITEMS);

  const emptyReason = agendaEmptyReason(capped.length, capReached, input.awaitingSetup);

  // Idle sleep wakes at the sooner of the poll cadence and the next search due, clamped both ways.
  const secondsUntilSearch = input.nextSearchRunAt
    ? Math.max(0, Math.round((input.nextSearchRunAt.getTime() - now.getTime()) / 1000))
    : Number.POSITIVE_INFINITY;

  const idleSleep = clamp(
    Math.min(config.checkIntervalMinutes * 60, secondsUntilSearch),
    MIN_IDLE_SLEEP_SECONDS,
    MAX_IDLE_SLEEP_SECONDS,
  );

  const sleepSeconds = capped.length > 0 ? ACTIVE_SLEEP_SECONDS : idleSleep;

  return {
    generatedAt: now,
    items: capped,
    counts: {
      openQuestions: input.openQuestions,
      activeClaims: input.activeClaims,
      approvedJobs: input.approvedJobs.length,
      appliedToday: input.appliedToday,
    },
    budget: {
      dailyApplyCap: config.dailyApplyCap,
      appliedToday: input.appliedToday,
      capReached,
      dailyNetworkingCap: config.networking.dailyCap,
      networkingSentToday: input.networkingSentToday,
      resetsAt: nextDayReset(now),
    },
    emptyReason,
    sleepSeconds,
    nextWakeAt: new Date(now.getTime() + sleepSeconds * 1000),
  };
}
