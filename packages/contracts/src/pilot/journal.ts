import { z } from "zod/v4";
import { csvArray, cursorPageSchema, cursorQuerySchema } from "../pagination";

const PILOT_JOURNAL_KINDS = [
  "cycle",
  "action",
  "observation",
  "question",
  "system",
  "digest",
  // A user override (declined/edited a draft) captured as a labeled learning signal.
  "correction",
] as const;
const pilotJournalKindSchema = z.enum(PILOT_JOURNAL_KINDS);

const pilotJournalEntryInputSchema = z.object({
  kind: pilotJournalKindSchema,
  summary: z.string(),
  detail: z.record(z.string(), z.json()).optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
});

export const createPilotJournalSchema = z.object({
  cycleId: z.string().optional(),
  entries: z.array(pilotJournalEntryInputSchema).min(1),
});

export const pilotJournalEntrySchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  cycleId: z.string().nullable(),
  kind: pilotJournalKindSchema,
  summary: z.string(),
  detail: z.record(z.string(), z.json()),
  subjectType: z.string().nullable(),
  subjectId: z.string().nullable(),
  createdAt: z.date(),
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

/** Terminal outcome of one orchestrator cycle - the vocabulary shared by the journal detail and the host's sentinel. */
export const PILOT_CYCLE_STATUSES = ["ok", "empty", "error"] as const;
export const pilotCycleStatusSchema = z.enum(PILOT_CYCLE_STATUSES);
export type PilotCycleStatus = z.infer<typeof pilotCycleStatusSchema>;

/**
 * `kind="cycle"` detail: the host's completion signal when the sentinel is mangled.
 * Fields are optional because stall-recovery cycles usually omit them, and a strict parse would drop those.
 */
export const pilotCycleDetailSchema = z
  .object({
    status: pilotCycleStatusSchema.optional(),
    sleepSeconds: z.number().int().optional(),
  })
  .loose();
