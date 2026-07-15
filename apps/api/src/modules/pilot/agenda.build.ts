import type { AgendaItem, AgendaResponse, PilotMandateConfig } from "@jobpilot/contracts/pilot";
import { isWithinActiveHours, nextDayResetInTz, secondsUntilNextWindow } from "./pilot.time";

/** Idle poll cadence has a floor so a tiny `checkIntervalMinutes` can't spin the loop. */
const MIN_IDLE_SLEEP_SECONDS = 30;
/** When work is queued the agent should return quickly after finishing it. */
const ACTIVE_SLEEP_SECONDS = 15;

// Category bases; job.apply is offset by matchScore so higher scores sort first, still under escalations.
const PRIORITY = {
  escalation: 1000,
  jobBase: 800,
  discover: 500,
  finalize: 100,
} as const;

const MAX_ITEMS = 10;

export interface AgendaEscalation {
  id: string;
  kind: string;
  question: string;
}

export interface AgendaApprovedJob {
  campaignId: string;
  key: string;
  title: string;
  url: string;
  board: string | null;
  digest: string | null;
  matchScore: number | null;
  resumeId?: string;
}

export interface AgendaDueQuery {
  query: string;
  board?: string;
  resumeId?: string;
}

export interface AgendaFinalizeCampaign {
  campaignId: string;
  query: string;
}

export interface AgendaInput {
  now: Date;
  config: PilotMandateConfig;
  openEscalations: number;
  answeredEscalations: AgendaEscalation[];
  activeLeases: number;
  approvedJobs: AgendaApprovedJob[];
  appliedToday: number;
  dueQueries: AgendaDueQuery[];
  finalizeCampaigns: AgendaFinalizeCampaign[];
}

/** Quiet-agenda wake-up: the mandate's check interval inside active hours, else the next window. */
function idleSleepSeconds({ now, config }: AgendaInput, within: boolean): number {
  if (!within) return secondsUntilNextWindow(now, config.activeHours);
  return Math.max(config.checkIntervalMinutes * 60, MIN_IDLE_SLEEP_SECONDS);
}

/**
 * Compile a prioritized agenda from already-fetched inputs. Pure: no I/O, so the
 * ordering, cap-suppression, budget, and sleep rules are unit-testable.
 *
 * Priority: escalation.answered > job.apply (by matchScore) > search.discover >
 * campaign.finalize. Outside active hours only escalation/finalize items are
 * emitted (no applies or discovery), and the agent sleeps until the window opens.
 */
export function buildAgenda(input: AgendaInput): AgendaResponse {
  const { now, config } = input;
  const within = isWithinActiveHours(now, config.activeHours);
  const capReached = input.appliedToday >= config.dailyApplyCap;

  const items: AgendaItem[] = [];

  for (const esc of input.answeredEscalations) {
    items.push({
      id: `escalation.answered:${esc.id}`,
      kind: "escalation.answered",
      priority: PRIORITY.escalation,
      title: `Apply answer: ${esc.question}`.slice(0, 200),
      subjectType: "escalation",
      subjectId: esc.id,
      payload: { escalationId: esc.id, escalationKind: esc.kind },
    });
  }

  if (within && !capReached) {
    for (const job of input.approvedJobs) {
      items.push({
        id: `job.apply:${job.campaignId}:${job.key}`,
        kind: "job.apply",
        priority: PRIORITY.jobBase + (job.matchScore ?? 0),
        title: job.title,
        subjectType: "job",
        subjectId: job.key,
        payload: {
          campaignId: job.campaignId,
          jobKey: job.key,
          url: job.url,
          board: job.board,
          digest: job.digest,
          resumeId: job.resumeId,
          matchScore: job.matchScore,
        },
      });
    }
  }

  // Discovery only fills the pipeline when there is nothing approved left to apply to.
  if (within && input.approvedJobs.length === 0) {
    for (const q of input.dueQueries) {
      items.push({
        id: `search.discover:${q.query}`,
        kind: "search.discover",
        priority: PRIORITY.discover,
        title: `Discover: ${q.query}`,
        subjectType: "campaign",
        subjectId: q.query,
        payload: {
          query: q.query,
          board: q.board,
          resumeId: q.resumeId,
          minScore: config.minScore,
        },
      });
    }
  }

  for (const c of input.finalizeCampaigns) {
    items.push({
      id: `campaign.finalize:${c.campaignId}`,
      kind: "campaign.finalize",
      priority: PRIORITY.finalize,
      title: `Finalize campaign: ${c.query}`,
      subjectType: "campaign",
      subjectId: c.campaignId,
      payload: { campaignId: c.campaignId },
    });
  }

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
