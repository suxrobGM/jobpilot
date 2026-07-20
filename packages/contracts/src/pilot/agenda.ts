import { z } from "zod/v4";

// ── Agenda ────────────────────────────────────────────────────────────────────

const AGENDA_ITEM_KINDS = [
  "question.answered",
  "job.apply",
  "search.discover",
  // Score an existing campaign's discovered-but-unscored pending rows (mid-batch abandonment / thin listings).
  "campaign.scorePending",
  "campaign.finalize",
  "inbox.review",
  "networking.send",
  "networking.followup",
  "networking.warmIntro",
  "promo.compose",
  "promo.post",
  "interview.reply",
  "interview.prep",
  // M4 proactive work + board health.
  "queue.drain",
  "board.health",
  "campaign.strategyReview",
  "job.rescanSkipped",
  "job.retryFailed",
  // Self-setup: derive goals/saved searches when the pipeline is empty and none exist.
  "strategy.bootstrap",
] as const;
const agendaItemKindSchema = z.enum(AGENDA_ITEM_KINDS);

const AGENDA_SUBJECT_TYPES = [
  "job",
  "campaign",
  "question",
  "networking",
  "inbox",
  "promotion",
  "application",
  "email",
  "queue",
  "board",
  // The pilot's own instructions (strategy.bootstrap subjects itself, not a row).
  "pilot",
] as const;
const agendaSubjectTypeSchema = z.enum(AGENDA_SUBJECT_TYPES);

const agendaItemSchema = z.object({
  id: z.string(),
  kind: agendaItemKindSchema,
  priority: z.number(),
  title: z.string(),
  subjectType: agendaSubjectTypeSchema,
  subjectId: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

const agendaCountsSchema = z.object({
  openQuestions: z.number().int(),
  activeLeases: z.number().int(),
  approvedJobs: z.number().int(),
  appliedToday: z.number().int(),
});

const agendaBudgetSchema = z.object({
  dailyApplyCap: z.number().int(),
  appliedToday: z.number().int(),
  capReached: z.boolean(),
  resetsAt: z.date(),
});

/**
 * Why the agenda has no items, decided server-side so clients don't re-infer suppression rules:
 * `capReached` (apply budget spent), `awaitingSetup` (no saved searches yet, bootstrap still
 * pending), `clear` (everything's done). Null when the agenda is non-empty.
 */
const agendaEmptyReasonSchema = z.enum(["capReached", "awaitingSetup", "clear"]);

export const agendaResponseSchema = z.object({
  generatedAt: z.date(),
  items: z.array(agendaItemSchema),
  counts: agendaCountsSchema,
  budget: agendaBudgetSchema,
  emptyReason: agendaEmptyReasonSchema.nullable(),
  sleepSeconds: z.number(),
  nextWakeAt: z.date(),
});

export type AgendaItem = z.infer<typeof agendaItemSchema>;
export type AgendaResponse = z.infer<typeof agendaResponseSchema>;
