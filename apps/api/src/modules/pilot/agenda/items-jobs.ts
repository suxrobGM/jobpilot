import type { AgendaItem, PilotInstructionsConfig } from "@jobpilot/contracts/pilot";
import { MAX_WARM_INTROS, PRIORITY, WARM_INTRO_MIN_SCORE } from "./constants";
import type {
  AgendaApprovedJob,
  AgendaDueQuery,
  AgendaEscalation,
  AgendaFinalizeCampaign,
} from "./types";

/** Answered escalations - the highest-priority "apply the user's answer" work. */
export function buildEscalationItems(escalations: AgendaEscalation[]): AgendaItem[] {
  return escalations.map((esc) => ({
    id: `escalation.answered:${esc.id}`,
    kind: "escalation.answered",
    priority: PRIORITY.escalation,
    title: `Apply answer: ${esc.question}`.slice(0, 200),
    subjectType: "escalation",
    subjectId: esc.id,
    // Enriched with subject + Q/A so the worker can route non-job answers (email replies, outreach) directly.
    payload: {
      escalationId: esc.id,
      escalationKind: esc.kind,
      subjectType: esc.subjectType ?? null,
      subjectId: esc.subjectId ?? null,
      question: esc.question,
      answer: esc.answer ?? null,
    },
  }));
}

export function buildJobApplyItems(jobs: AgendaApprovedJob[]): AgendaItem[] {
  return jobs.map((job) => {
    const warm = job.warmContacts ?? [];
    return {
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
        // Warm contacts ride the apply item so the worker can mention a known insider.
        warmContacts: warm.length > 0 ? warm : undefined,
      },
    };
  });
}

/** One warm intro per agenda, ranked above discovery; gates on score, not the apply cap. */
export function buildWarmIntroItems(jobs: AgendaApprovedJob[]): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const job of jobs) {
    const warm = job.warmContacts ?? [];
    if (warm.length === 0 || (job.matchScore ?? 0) < WARM_INTRO_MIN_SCORE) continue;
    if (items.length >= MAX_WARM_INTROS) break;
    items.push({
      id: `outreach.warmIntro:${job.campaignId}:${job.key}`,
      kind: "outreach.warmIntro",
      priority: PRIORITY.warmIntro,
      title: `Warm intro: ${job.title}`.slice(0, 200),
      subjectType: "outreach",
      subjectId: `${job.campaignId}:${job.key}`,
      payload: {
        campaignId: job.campaignId,
        jobKey: job.key,
        company: job.company ?? null,
        jobTitle: job.title,
        jobUrl: job.url,
        contacts: warm,
      },
    });
  }
  return items;
}

/** Discovery fills the pipeline only when nothing approved is left to apply to (gated by the caller). */
export function buildDiscoverItems(
  queries: AgendaDueQuery[],
  config: PilotInstructionsConfig,
): AgendaItem[] {
  return queries.map((q) => ({
    id: `search.discover:${q.query}`,
    kind: "search.discover",
    priority: PRIORITY.discover,
    title: `Discover: ${q.query}`,
    subjectType: "campaign",
    subjectId: q.query,
    payload: { query: q.query, board: q.board, resumeId: q.resumeId, minScore: config.minScore },
  }));
}

export function buildFinalizeItems(campaigns: AgendaFinalizeCampaign[]): AgendaItem[] {
  return campaigns.map((c) => ({
    id: `campaign.finalize:${c.campaignId}`,
    kind: "campaign.finalize",
    priority: PRIORITY.finalize,
    title: `Finalize campaign: ${c.query}`,
    subjectType: "campaign",
    subjectId: c.campaignId,
    payload: { campaignId: c.campaignId },
  }));
}
