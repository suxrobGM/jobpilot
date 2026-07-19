import { z } from "zod/v4";

// ── Agenda ────────────────────────────────────────────────────────────────────

const AGENDA_ITEM_KINDS = [
  "question.answered",
  "job.apply",
  "search.discover",
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

export const agendaResponseSchema = z.object({
  generatedAt: z.date(),
  items: z.array(agendaItemSchema),
  counts: agendaCountsSchema,
  budget: agendaBudgetSchema,
  sleepSeconds: z.number(),
  nextWakeAt: z.date(),
});

export type AgendaItem = z.infer<typeof agendaItemSchema>;
export type AgendaResponse = z.infer<typeof agendaResponseSchema>;
