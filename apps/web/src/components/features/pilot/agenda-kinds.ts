import type { AgendaItem } from "@jobpilot/contracts/pilot";

/** Required record: a new agenda kind fails typecheck until it gets a label. */
const AGENDA_KIND_LABELS: Record<AgendaItem["kind"], string> = {
  "question.answered": "Act on answered question",
  "job.apply": "Apply to job",
  "search.discover": "Run saved search",
  "campaign.scorePending": "Score discovered jobs",
  "campaign.reviewPaused": "Review paused campaign",
  "inbox.review": "Review inbox email",
  "networking.send": "Send networking message",
  "networking.followup": "Follow up on networking message",
  "networking.warmIntro": "Ask for a warm intro",
  "promo.compose": "Draft promotion post",
  "promo.post": "Publish promotion post",
  "interview.reply": "Reply about an interview",
  "interview.prep": "Prepare interview notes",
  "queue.drain": "Score pasted links",
  "board.health": "Board health check",
  "campaign.strategyReview": "Review campaign strategy",
  "job.rescanSkipped": "Rescan skipped jobs",
  "job.retryFailed": "Retry failed jobs",
  "strategy.bootstrap": "Set up goals and saved searches",
};

/**
 * Falls back to the raw kind: claim history keeps kinds the agenda no longer emits, and a cost row
 * for a retired kind is still worth showing.
 */
export function agendaKindLabel(kind: string): string {
  return (AGENDA_KIND_LABELS as Record<string, string | undefined>)[kind] ?? kind;
}
