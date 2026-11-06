import { z } from "zod/v4";
import { cursorPageSchema, cursorQuerySchema } from "../pagination";
import { pilotChangeSchema } from "./change";
import { pilotJournalEntrySchema } from "./journal";
import { pilotMessageSchema } from "./message";
import { pilotQuestionSchema } from "./question";
import { pilotRequestSchema } from "./request";
import { PILOT_RUN_OUTCOMES } from "./run";
import { pilotSubjectTypeSchema } from "./tasks";

const pilotThreadRunSchema = z.object({
  runId: z.uuid(),
  taskType: z.string(),
  title: z.string(),
  summary: z.string(),
  outcome: z.enum(PILOT_RUN_OUTCOMES).nullable(),
  subjectType: pilotSubjectTypeSchema.nullable(),
  subjectId: z.string().nullable(),
  finishedAt: z.date(),
});

/** Every item carries `at`, the moment it sorts by in the thread. */
const pilotThreadItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("work"),
    id: z.string(),
    at: z.date(),
    startedAt: z.date(),
    endedAt: z.date(),
    runs: z.array(pilotThreadRunSchema),
  }),
  z.object({
    type: z.literal("question"),
    id: z.string(),
    at: z.date(),
    question: pilotQuestionSchema,
  }),
  z.object({
    type: z.literal("digest"),
    id: z.string(),
    at: z.date(),
    entry: pilotJournalEntrySchema,
  }),
  z.object({
    type: z.literal("change"),
    id: z.string(),
    at: z.date(),
    change: pilotChangeSchema,
  }),
  z.object({
    type: z.literal("message"),
    id: z.string(),
    at: z.date(),
    message: pilotMessageSchema,
  }),
  z.object({
    type: z.literal("request"),
    id: z.string(),
    at: z.date(),
    request: pilotRequestSchema,
  }),
  z.object({
    type: z.literal("note"),
    id: z.string(),
    at: z.date(),
    entry: pilotJournalEntrySchema,
  }),
]);

export const pilotThreadQuerySchema = cursorQuerySchema;

/** Newest first; the cursor is a journal entry id. */
export const pilotThreadPageSchema = cursorPageSchema(pilotThreadItemSchema);

export type PilotThreadRun = z.infer<typeof pilotThreadRunSchema>;
export type PilotThreadItem = z.infer<typeof pilotThreadItemSchema>;
export type PilotThreadPage = z.infer<typeof pilotThreadPageSchema>;
