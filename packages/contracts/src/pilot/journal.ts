import { z } from "zod/v4";

// ── Journal ───────────────────────────────────────────────────────────────────

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
  detail: z.record(z.string(), z.unknown()).optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
});

export const createPilotJournalSchema = z.object({
  cycleId: z.string().optional(),
  entries: z.array(pilotJournalEntryInputSchema).min(1),
});

export const pilotJournalEntrySchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  cycleId: z.string().nullable(),
  kind: pilotJournalKindSchema,
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()),
  subjectType: z.string().nullable(),
  subjectId: z.string().nullable(),
  createdAt: z.date(),
});

export const pilotJournalQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const pilotJournalPageSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
  nextCursor: z.string().nullable(),
});

export type PilotJournalKind = z.infer<typeof pilotJournalKindSchema>;
export type CreatePilotJournalInput = z.infer<typeof createPilotJournalSchema>;
export type PilotJournalEntry = z.infer<typeof pilotJournalEntrySchema>;
