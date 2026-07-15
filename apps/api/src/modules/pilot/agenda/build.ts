import type { AgendaItem, AgendaResponse } from "@jobpilot/contracts/pilot";
import { isWithinActiveHours, nextDayResetInTz, secondsUntilNextWindow } from "../pilot.time";
import { ACTIVE_SLEEP_SECONDS, MAX_ITEMS, MIN_IDLE_SLEEP_SECONDS } from "./constants";
import { buildInterviewPrepItems, buildInterviewReplyItems } from "./items-interview";
import {
  buildDiscoverItems,
  buildEscalationItems,
  buildFinalizeItems,
  buildJobApplyItems,
  buildWarmIntroItems,
} from "./items-jobs";
import { buildFollowupItems, buildInboxItem, buildOutreachSendItems } from "./items-outreach";
import { buildPromoComposeItems, buildPromoPostItems } from "./items-promo";
import type { AgendaInput } from "./types";

/** Quiet-agenda wake-up: the mandate's check interval inside active hours, else the next window. */
function idleSleepSeconds({ now, config }: AgendaInput, within: boolean): number {
  if (!within) return secondsUntilNextWindow(now, config.activeHours);
  return Math.max(config.checkIntervalMinutes * 60, MIN_IDLE_SLEEP_SECONDS);
}

/**
 * Compile a prioritized agenda from already-fetched inputs. Pure: no I/O, so the
 * ordering, cap-suppression, budget, and sleep rules are unit-testable.
 *
 * Priority: escalation.answered > interview.reply > job.apply (by matchScore) >
 * interview.prep > outreach.send > inbox.triage > promo.post > outreach.warmIntro >
 * search.discover > outreach.followup > promo.compose > campaign.finalize. Outside
 * active hours only escalation/finalize items are emitted, and the agent sleeps until
 * the window opens.
 */
export function buildAgenda(input: AgendaInput): AgendaResponse {
  const { now, config } = input;
  const within = isWithinActiveHours(now, config.activeHours);
  const capReached = input.appliedToday >= config.dailyApplyCap;
  // Outreach headroom is independent of the apply cap; it gates sends and followups alike.
  const sendHeadroom = Math.max(0, config.dailyOutreachCap - input.outreachSentToday);

  const items: AgendaItem[] = [...buildEscalationItems(input.answeredEscalations)];
  if (within && !capReached) items.push(...buildJobApplyItems(input.approvedJobs));
  if (within) {
    // Interview work is gated like the rest - replying at 3am reads as a bot.
    items.push(...buildInterviewReplyItems(input.interviewReplies));
    items.push(...buildInterviewPrepItems(input.interviewPreps));
    items.push(...buildWarmIntroItems(input.approvedJobs));
    items.push(...buildOutreachSendItems(input.approvedOutreach, sendHeadroom));
    items.push(...buildInboxItem(input.inbox));
    items.push(...buildPromoPostItems(input.approvedPromotions));
    // Discovery only fills the pipeline when there is nothing approved left to apply to.
    if (input.approvedJobs.length === 0)
      items.push(...buildDiscoverItems(input.dueQueries, config));
    if (sendHeadroom > 0) items.push(...buildFollowupItems(input.followups));
    items.push(...buildPromoComposeItems(input.dueVenues));
  }
  items.push(...buildFinalizeItems(input.finalizeCampaigns));

  items.sort((a, b) => b.priority - a.priority);
  const capped = items.slice(0, MAX_ITEMS);

  const sleepSeconds = capped.length > 0 ? ACTIVE_SLEEP_SECONDS : idleSleepSeconds(input, within);

  return {
    generatedAt: now,
    items: capped,
    counts: {
      openEscalations: input.openEscalations,
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
