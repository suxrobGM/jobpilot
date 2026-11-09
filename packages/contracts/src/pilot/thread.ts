import { z } from "zod/v4";
import { jobStatusSchema } from "../feed";
import { cursorPageSchema, cursorQuerySchema } from "../pagination";
import { pilotChangeSchema } from "./change";
import { pilotMessageSchema } from "./message";
import { pilotQuestionSchema } from "./question";
import { pilotRequestSchema } from "./request";
import { PILOT_RUN_OUTCOMES } from "./run";
import { pilotSubjectTypeSchema } from "./tasks";

/** The job a run touched, read live so a rescored job shows its current score and status. */
const pilotThreadJobSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  company: z.string(),
  score: z.number().int().nullable(),
  status: jobStatusSchema,
  applicationId: z.uuid().nullable(),
});

const pilotThreadRunSchema = z.object({
  runId: z.uuid(),
  taskType: z.string(),
  title: z.string(),
  summary: z.string(),
  outcome: z.enum(PILOT_RUN_OUTCOMES).nullable(),
  subjectType: pilotSubjectTypeSchema.nullable(),
  subjectId: z.string().nullable(),
  job: pilotThreadJobSchema.nullable(),
  // A job.apply run that applied: the job's application landed during this run.
  applied: z.boolean(),
  finishedAt: z.date(),
});

/** A sitting's search and score runs, totalled so they read as one line. */
const pilotThreadSearchTallySchema = z.object({
  searches: z.number().int(),
  newJobs: z.number().int(),
  scored: z.number().int(),
  passed: z.number().int(),
  best: pilotThreadJobSchema.nullable(),
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
    searchTally: pilotThreadSearchTallySchema.nullable(),
  }),
  z.object({
    type: z.literal("question"),
    id: z.string(),
    at: z.date(),
    question: pilotQuestionSchema,
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
    // The job a job.apply request named, so the row can say how it went.
    job: pilotThreadJobSchema.nullable(),
  }),
]);

export const pilotThreadQuerySchema = cursorQuerySchema;

/** Newest first; the cursor is a run id. */
export const pilotThreadPageSchema = cursorPageSchema(pilotThreadItemSchema);

export type PilotThreadJob = z.infer<typeof pilotThreadJobSchema>;
export type PilotThreadRun = z.infer<typeof pilotThreadRunSchema>;
export type PilotThreadSearchTally = z.infer<typeof pilotThreadSearchTallySchema>;
export type PilotThreadItem = z.infer<typeof pilotThreadItemSchema>;
export type PilotThreadPage = z.infer<typeof pilotThreadPageSchema>;
