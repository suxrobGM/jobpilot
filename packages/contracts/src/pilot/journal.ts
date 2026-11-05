import { z } from "zod/v4";
import { csvArray, cursorPageSchema, cursorQuerySchema } from "../pagination";
import { journalDetailSchema, tokenUsageSchema } from "./run";
import { pilotSubjectTypeSchema } from "./tasks";

export const PILOT_JOURNAL_KINDS = [
  "cycle",
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

/** Cursor-paged, not offset: the feed grows at the head while the orchestrator runs. */
export const pilotJournalQuerySchema = cursorQuerySchema.extend({
  kinds: csvArray(pilotJournalKindSchema).optional(),
});

export const pilotJournalPageSchema = cursorPageSchema(pilotJournalEntrySchema);

export type PilotJournalKind = z.infer<typeof pilotJournalKindSchema>;
export type CreatePilotJournalInput = z.infer<typeof createPilotJournalSchema>;
export type PilotJournalEntry = z.infer<typeof pilotJournalEntrySchema>;
export type PilotJournalPage = z.infer<typeof pilotJournalPageSchema>;
export type PilotJournalRun = z.infer<typeof pilotJournalRunSchema>;

/** An idle check: the host found nothing to do and sleeps this long. */
export const recordIdleCycleSchema = z.object({ sleepSeconds: z.number().int().min(0) });
export type RecordIdleCycleInput = z.infer<typeof recordIdleCycleSchema>;

/** A cycle's outcome; an empty one is reported in host health, never journaled. */
const pilotCycleStatusSchema = z.enum(["ok", "empty", "error"]);
export type PilotCycleStatus = z.infer<typeof pilotCycleStatusSchema>;

/** Optional fields: stuck-recovery cycles usually journal an empty detail. */
export const pilotCycleDetailSchema = z
  .object({
    status: pilotCycleStatusSchema.optional(),
    sleepSeconds: z.number().int().optional(),
  })
  .loose();
