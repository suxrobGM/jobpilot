import { z } from "zod/v4";
import { CAMPAIGN_JOB_STATUSES } from "../campaign";
import { savedAnswerKeySchema } from "./answers";

export const PILOT_CHANGE_SOURCES = ["user", "chat", "pilot", "notice"] as const;
export const PILOT_CHANGE_STATUSES = ["proposed", "applied", "undone", "dismissed"] as const;
const pilotChangeStatusSchema = z.enum(PILOT_CHANGE_STATUSES);

const dealBreakersSchema = z.array(z.string().trim().min(1).max(200)).max(30);
const searchNameSchema = z.string().trim().min(1).max(120);
const jobRefSchema = z.object({ campaignId: z.uuid(), key: z.string().min(1) });

/** One edit; every action has an inverse, so an applied change can be undone. */
export const pilotChangeActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("goals.set"), goals: z.string().trim() }),
  z.object({
    type: z.literal("rules.set"),
    dailyApplyCap: z.number().int().min(0).optional(),
    minScore: z.number().min(0).max(100).optional(),
    dealBreakers: dealBreakersSchema.optional(),
    preferCapExempt: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("search.create"),
    name: searchNameSchema,
    query: z.string().trim().min(1),
    /** The board's domain. */
    board: z.string().trim().min(1).optional(),
    resumeId: z.uuid().optional(),
    reason: z.string().max(500).default(""),
  }),
  z.object({
    type: z.literal("search.update"),
    searchId: z.uuid(),
    name: searchNameSchema.optional(),
    query: z.string().trim().min(1).optional(),
    reason: z.string().max(500).optional(),
  }),
  z.object({ type: z.literal("search.pause"), searchId: z.uuid() }),
  z.object({ type: z.literal("search.resume"), searchId: z.uuid() }),
  z.object({ type: z.literal("search.delete"), searchId: z.uuid() }),
  z.object({
    type: z.literal("answer.set"),
    key: savedAnswerKeySchema,
    value: z.string().trim().min(1),
  }),
  z.object({ type: z.literal("answer.delete"), key: savedAnswerKeySchema }),
  z.object({
    type: z.literal("jobs.skip"),
    refs: z.array(jobRefSchema).min(1).max(500),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    type: z.literal("jobs.restore"),
    refs: z.array(jobRefSchema.extend({ status: z.enum(CAMPAIGN_JOB_STATUSES) })).max(500),
  }),
]);

export type PilotChangeAction = z.infer<typeof pilotChangeActionSchema>;

export const createPilotChangeSchema = z.object({
  summary: z.string().trim().min(1).max(300),
  actions: z.array(pilotChangeActionSchema).min(1).max(50),
  source: z.enum(PILOT_CHANGE_SOURCES).default("user"),
  /** A suggestion the user applies or dismisses, instead of a change applied at once. */
  propose: z.boolean().default(false),
  runId: z.uuid().optional(),
});

export type CreatePilotChangeInput = z.infer<typeof createPilotChangeSchema>;

export const pilotChangesQuerySchema = z.object({ status: pilotChangeStatusSchema.optional() });

export const pilotChangeSchema = z.object({
  id: z.uuid(),
  source: z.enum(PILOT_CHANGE_SOURCES),
  status: pilotChangeStatusSchema,
  summary: z.string(),
  actions: z.array(pilotChangeActionSchema),
  /** Applied changes only, until the undo window closes. */
  canUndo: z.boolean(),
  runId: z.uuid().nullable(),
  createdAt: z.date(),
  decidedAt: z.date().nullable(),
});

export const pilotChangeListSchema = z.array(pilotChangeSchema);

export type PilotChange = z.infer<typeof pilotChangeSchema>;
