import { z } from "zod/v4";
import { csvArray, paginatedSchema, paginationQuerySchema } from "../pagination";
import { journalDetailSchema, tokenUsageSchema } from "./run";
import { pilotSubjectTypeSchema } from "./tasks";

export const PILOT_JOURNAL_KINDS = [
  "action",
  "question",
  "system",
  "digest",
  // The user declined or edited a draft: a labeled learning signal.
  "correction",
] as const;
const pilotJournalKindSchema = z.enum(PILOT_JOURNAL_KINDS);

const pilotJournalEntryInputSchema = z.object({
  kind: pilotJournalKindSchema,
  summary: z.string(),
  detail: journalDetailSchema.optional(),
  subjectType: pilotSubjectTypeSchema.optional(),
  subjectId: z.string().optional(),
});

export const createPilotJournalSchema = z.object({
  runId: z.uuid().optional(),
  entries: z.array(pilotJournalEntryInputSchema).min(1),
});

/** The run an entry's cycle worked; tokens stay null until the host reports the cycle's usage. */
const pilotJournalRunSchema = z.object({
  taskType: z.string(),
  tokens: tokenUsageSchema.nullable(),
});

export const pilotJournalEntrySchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  runId: z.uuid().nullable(),
  kind: pilotJournalKindSchema,
  summary: z.string(),
  detail: journalDetailSchema,
  subjectType: pilotSubjectTypeSchema.nullable(),
  subjectId: z.string().nullable(),
  createdAt: z.date(),
  run: pilotJournalRunSchema.nullable(),
});

/** Offset-paged for a numbered pager; live entries shift later pages, which only page 1 shows. */
export const pilotJournalQuerySchema = paginationQuerySchema.extend({
  kinds: csvArray(pilotJournalKindSchema).optional(),
});

export const pilotJournalPageSchema = paginatedSchema(pilotJournalEntrySchema);

export type PilotJournalKind = z.infer<typeof pilotJournalKindSchema>;
export type CreatePilotJournalInput = z.infer<typeof createPilotJournalSchema>;
export type PilotJournalEntry = z.infer<typeof pilotJournalEntrySchema>;
export type PilotJournalPage = z.infer<typeof pilotJournalPageSchema>;
export type PilotJournalRun = z.infer<typeof pilotJournalRunSchema>;

/** One host loop pass, with or without a run; the host sleeps this long before the next. */
export const recordCycleSchema = z.object({ sleepSeconds: z.number().int().min(0) });
export type RecordCycleInput = z.infer<typeof recordCycleSchema>;

/** Reported in host health only. */
const pilotCycleStatusSchema = z.enum(["ok", "empty", "error"]);
export type PilotCycleStatus = z.infer<typeof pilotCycleStatusSchema>;
