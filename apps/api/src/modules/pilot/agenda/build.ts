import type { AgendaContent, AgendaItem } from "@jobpilot/contracts/pilot";
import { nextDayReset } from "@/common/date/buckets";
import { ACTIVE_SLEEP_SECONDS, MAX_ITEMS, MIN_IDLE_SLEEP_SECONDS } from "./constants";
import { buildInterviewPrepItems, buildInterviewReplyItems } from "./items-interview";
import {
  buildDiscoverItems,
  buildFinalizeItems,
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
  buildQueueDrainItem,
  buildRescanSkippedItems,
  buildRetryFailedItems,
  buildStrategyReviewItems,
} from "./items-proactive";
import { buildPromoComposeItems, buildPromoPostItems } from "./items-promo";
import type { AgendaInput } from "./types";

/**
 * Name why the agenda is empty so clients render it instead of re-deriving suppression rules.
 * No saved searches + empty means bootstrap was gathered but suppressed (recent attempt / open
 * question) - otherwise it would be an item; either way the pilot still needs setup.
 */
function agendaEmptyReason(
  itemCount: number,
  capReached: boolean,
  savedSearchCount: number,
): AgendaContent["emptyReason"] {
  if (itemCount > 0) return null;
  if (capReached) return "capReached";
  if (savedSearchCount === 0) return "awaitingSetup";
  return "clear";
}

/**
 * Compile a prioritized agenda from already-fetched inputs. Pure: no I/O, so the ordering,
 * cap-suppression, budget, and sleep rules are unit-testable. Ranking lives in PRIORITY
 * (./constants).
 */
export function buildAgenda(input: AgendaInput): AgendaContent {
  const { now, config } = input;
  const capReached = input.appliedToday >= config.dailyApplyCap;
  // Networking headroom is independent of the apply cap; it gates sends and followups alike.
  const sendHeadroom = Math.max(0, config.dailyNetworkingCap - input.networkingSentToday);

  const items: AgendaItem[] = [...buildQuestionItems(input.answeredQuestions)];
  if (!capReached) items.push(...buildJobApplyItems(input.approvedJobs));
  // Board health outranks apply work: a failing board should be probed before more attempts pile on.
  items.push(...buildBoardHealthItems(input.boardHealth));
  // Ungated by cap/busy: a stranded paused campaign must surface regardless.
  items.push(...buildReviewPausedItems(input.pausedCampaigns));
  items.push(...buildInterviewReplyItems(input.interviewReplies));
  items.push(...buildInterviewPrepItems(input.interviewPreps));
  // User-curated URLs are proactive apply work, ranked just under the scored apply queue.
  items.push(...buildQueueDrainItem(input.queue));
  items.push(...buildWarmIntroItems(input.approvedJobs));
  const sendItems = buildNetworkingSendItems(input.approvedNetworking, sendHeadroom);
  items.push(...sendItems);
  items.push(...buildInboxItem(input.inbox));
  items.push(...buildPromoPostItems(input.approvedPromotions));
  // Scoring an existing campaign's pending rows and fresh discovery both only matter when there is
  // nothing approved left to apply to; scoring ranks first so found-but-unscored work finishes first.
  if (input.approvedJobs.length === 0) {
    items.push(...buildScorePendingItems(input.scorePending));
    items.push(...buildDiscoverItems(input.dueQueries, config));
  }
  // Followups spend the same send budget, so they only get the headroom the sends left over.
  const followupHeadroom = sendHeadroom - sendItems.length;
  if (followupHeadroom > 0)
    items.push(...buildFollowupItems(input.followups.slice(0, followupHeadroom)));
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
  items.push(...buildFinalizeItems(input.finalizeCampaigns));

  // Opt-in networking: one category gate covers every `networking.*` kind by construction. `inbox.review`
  // is deliberately outside the namespace so mail triage (interview replies) survives networking being off.
  const ranked = config.networkingEnabled
    ? items
    : items.filter((i) => !i.kind.startsWith("networking."));

  ranked.sort((a, b) => b.priority - a.priority);
  const capped = ranked.slice(0, MAX_ITEMS);

  const emptyReason = agendaEmptyReason(capped.length, capReached, config.savedSearches.length);

  const sleepSeconds =
    capped.length > 0
      ? ACTIVE_SLEEP_SECONDS
      : Math.max(config.checkIntervalMinutes * 60, MIN_IDLE_SLEEP_SECONDS);

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
      resetsAt: nextDayReset(now),
    },
    emptyReason,
    sleepSeconds,
    nextWakeAt: new Date(now.getTime() + sleepSeconds * 1000),
  };
}
