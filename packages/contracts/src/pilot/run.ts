import { z } from "zod/v4";
import { csvArray, paginatedSchema, paginationQuerySchema } from "../pagination";
import { taskFieldsSchema } from "./tasks";

export const PILOT_RUN_OUTCOMES = ["done", "failed", "cancelled", "expired"] as const;
const pilotRunOutcomeSchema = z.enum(PILOT_RUN_OUTCOMES);

export const startPilotRunSchema = z.object({ taskId: z.string().min(1) });

export const pilotRunResultSchema = z.object({
  outcome: z.enum(["done", "failed"]),
  // The run's result line, human and specific.
  summary: z.string().trim().min(1),
  // `reply` answers work the user asked for in chat.
  detail: z.object({ reply: z.string().trim().min(1).optional() }).optional(),
});

/** Typed into the running session as one line. */
export const steerPilotRunSchema = z.object({ text: z.string().trim().min(1).max(1000) });

export const reportPilotUsageSchema = z.object({
  model: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadTokens: z.number().int().min(0),
  cacheWriteTokens: z.number().int().min(0),
});

/** A run's token usage as the web reads it, split because cache reads dwarf the rest. */
export const tokenUsageSchema = z.object({
  input: z.number().int(),
  output: z.number().int(),
  cacheRead: z.number().int(),
  cacheWrite: z.number().int(),
});

export type TokenUsage = z.infer<typeof tokenUsageSchema>;

/** Cache reads re-read context already sent and cost a fraction of the rest, so they are left out. */
export function newTokens(usage: TokenUsage): number {
  return usage.input + usage.output + usage.cacheWrite;
}

type TokenColumn = "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens";

/** A run's token columns. Nullable so a Prisma `_sum` fits as is. */
type TokenCounts = Record<TokenColumn, number | null>;

export function tokenUsage(counts: TokenCounts): TokenUsage {
  return {
    input: counts.inputTokens ?? 0,
    output: counts.outputTokens ?? 0,
    cacheRead: counts.cacheReadTokens ?? 0,
    cacheWrite: counts.cacheWriteTokens ?? 0,
  };
}

export function sumTokenUsage(usages: TokenUsage[]): TokenUsage {
  return {
    input: usages.reduce((sum, usage) => sum + usage.input, 0),
    output: usages.reduce((sum, usage) => sum + usage.output, 0),
    cacheRead: usages.reduce((sum, usage) => sum + usage.cacheRead, 0),
    cacheWrite: usages.reduce((sum, usage) => sum + usage.cacheWrite, 0),
  };
}

const pilotRunBaseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  startedAt: z.date(),
  heartbeatAt: z.date().nullable(),
  expiresAt: z.date(),
  finishedAt: z.date().nullable(),
  outcome: pilotRunOutcomeSchema.nullable(),
  summary: z.string().nullable(),
  // The user asked for this work in chat: the result's `detail.reply` answers them there.
  askedInChat: z.boolean(),
});

export const pilotRunSchema = z.intersection(pilotRunBaseSchema, taskFieldsSchema);

/** A finished run as Diagnostics lists it; tokens stay null until the host reports the cycle. */
const pilotRunHistoryItemSchema = z.object({
  id: z.uuid(),
  taskType: z.string(),
  title: z.string(),
  outcome: pilotRunOutcomeSchema,
  summary: z.string().nullable(),
  finishedAt: z.date(),
  tokens: tokenUsageSchema.nullable(),
});

export const pilotRunHistoryQuerySchema = paginationQuerySchema.extend({
  outcomes: csvArray(pilotRunOutcomeSchema).optional(),
});

export const pilotRunHistoryPageSchema = paginatedSchema(pilotRunHistoryItemSchema);

export type PilotRun = z.infer<typeof pilotRunSchema>;
export type PilotRunOutcome = z.infer<typeof pilotRunOutcomeSchema>;
export type PilotRunHistoryItem = z.infer<typeof pilotRunHistoryItemSchema>;
export type PilotRunHistoryQuery = z.infer<typeof pilotRunHistoryQuerySchema>;
export type PilotRunResultInput = z.infer<typeof pilotRunResultSchema>;
export type ReportPilotUsageInput = z.infer<typeof reportPilotUsageSchema>;
