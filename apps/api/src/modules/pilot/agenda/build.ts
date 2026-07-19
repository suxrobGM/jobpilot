import type { AgendaItem, AgendaResponse } from "@jobpilot/contracts/pilot";
import { isWithinActiveHours, nextDayResetInTz, secondsUntilNextWindow } from "../pilot.time";
import { ACTIVE_SLEEP_SECONDS, MAX_ITEMS, MIN_IDLE_SLEEP_SECONDS } from "./constants";
import { buildInterviewPrepItems, buildInterviewReplyItems } from "./items-interview";
import {
  buildDiscoverItems,
  buildFinalizeItems,
  buildJobApplyItems,
  buildQuestionItems,
  buildWarmIntroItems,
} from "./items-jobs";
import { buildFollowupItems, buildInboxItem, buildNetworkingSendItems } from "./items-networking";
import {
  buildBoardHealthItems,
  buildQueueDrainItem,
  buildRescanSkippedItems,
  buildRetryFailedItems,
  buildStrategyReviewItems,
} from "./items-proactive";
import { buildPromoComposeItems, buildPromoPostItems } from "./items-promo";
import type { AgendaInput } from "./types";

/** Quiet-agenda wake-up: the instructions' check interval inside active hours, else the next window. */
function idleSleepSeconds({ now, config }: AgendaInput, within: boolean): number {
  if (!within) return secondsUntilNextWindow(now, config.activeHours);
  return Math.max(config.checkIntervalMinutes * 60, MIN_IDLE_SLEEP_SECONDS);
}

/**
 * Compile a prioritized agenda from already-fetched inputs. Pure: no I/O, so the ordering,
 * cap-suppression, budget, and sleep rules are unit-testable. Ranking lives in PRIORITY
 * (./constants). Outside active hours only question/finalize items are emitted, and the
 * agent sleeps until the window opens.
 */
export function buildAgenda(input: AgendaInput): AgendaResponse {
  const { now, config } = input;
  const within = isWithinActiveHours(now, config.activeHours);
  const capReached = input.appliedToday >= config.dailyApplyCap;
  // Networking headroom is independent of the apply cap; it gates sends and followups alike.
  const sendHeadroom = Math.max(0, config.dailyNetworkingCap - input.networkingSentToday);

  const items: AgendaItem[] = [...buildQuestionItems(input.answeredQuestions)];
  if (within && !capReached) items.push(...buildJobApplyItems(input.approvedJobs));
  if (within) {
    // Board health outranks apply work: a failing board should be probed before more attempts pile on.
    items.push(...buildBoardHealthItems(input.boardHealth));
    // Interview work is gated like the rest - replying at 3am reads as a bot.
    items.push(...buildInterviewReplyItems(input.interviewReplies));
    items.push(...buildInterviewPrepItems(input.interviewPreps));
    // User-curated URLs are proactive apply work, ranked just under the scored apply queue.
    items.push(...buildQueueDrainItem(input.queue));
    items.push(...buildWarmIntroItems(input.approvedJobs));
    const sendItems = buildNetworkingSendItems(input.approvedNetworking, sendHeadroom);
    items.push(...sendItems);
    items.push(...buildInboxItem(input.inbox));
    items.push(...buildPromoPostItems(input.approvedPromotions));
    // Discovery only fills the pipeline when there is nothing approved left to apply to.
    if (input.approvedJobs.length === 0)
      items.push(...buildDiscoverItems(input.dueQueries, config));
    // Followups spend the same send budget, so they only get the headroom the sends left over.
    const followupHeadroom = sendHeadroom - sendItems.length;
    if (followupHeadroom > 0)
      items.push(...buildFollowupItems(input.followups.slice(0, followupHeadroom)));
    items.push(...buildPromoComposeItems(input.duePlatforms));

    // Quiet-agenda maintenance surfaces only when no apply / discover / queue work is queued.
    const busy = items.some(
      (i) => i.kind === "job.apply" || i.kind === "search.discover" || i.kind === "queue.drain",
    );
    if (!busy) {
      items.push(...buildStrategyReviewItems(input.strategyReviews));
      items.push(...buildRescanSkippedItems(input.rescanSkipped));
      items.push(...buildRetryFailedItems(input.retryFailed));
    }
  }
  items.push(...buildFinalizeItems(input.finalizeCampaigns));

  // Opt-in networking: one category gate covers every `networking.*` kind by construction. `inbox.review`
  // is deliberately outside the namespace so mail triage (interview replies) survives networking being off.
  const ranked = config.networkingEnabled
    ? items
    : items.filter((i) => !i.kind.startsWith("networking."));

  ranked.sort((a, b) => b.priority - a.priority);
  const capped = ranked.slice(0, MAX_ITEMS);

  const sleepSeconds = capped.length > 0 ? ACTIVE_SLEEP_SECONDS : idleSleepSeconds(input, within);

  return {
    generatedAt: now,
    items: capped,
    counts: {
      openQuestions: input.openQuestions,
      activeLeases: input.activeLeases,
      approvedJobs: input.approvedJobs.length,
      appliedToday: input.appliedToday,
    },
    budget: {
      dailyApplyCap: config.dailyApplyCap,
      appliedToday: input.appliedToday,
      capReached,
      resetsAt: nextDayResetInTz(now, config.activeHours?.tz),
    },
    sleepSeconds,
    nextWakeAt: new Date(now.getTime() + sleepSeconds * 1000),
  };
}
