import { z } from "zod/v4";

const pilotAutonomySchema = z.object({
  networkingEmail: z.enum(["draft", "review", "auto"]).default("review"),
  networkingLinkedIn: z.enum(["draft", "review"]).default("draft"),
});

const pilotPromotionPlatformSchema = z.object({
  platform: z.string().min(1),
  target: z.string().optional(),
  postEveryDays: z.number().int().min(1).default(30),
});

/** Self-promotion config. Review-only in M3: auto-posting is deliberately not offered. */
const pilotPromotionConfigSchema = z.object({
  platforms: z.array(pilotPromotionPlatformSchema).default([]),
  autonomy: z.literal("review").default("review"),
});

/**
 * The Pilot's operating envelope, stored as JSON in `PilotState.instructionsConfig`.
 * Every field defaults, so an empty `{}` parses to a full, usable config.
 */
export const pilotInstructionsConfigSchema = z.object({
  dailyApplyCap: z.number().int().min(0).default(10),
  minScore: z.number().min(0).max(100).default(60),
  boards: z.array(z.string()).default([]),
  checkIntervalMinutes: z.number().int().default(30),
  // Master switch: networking is opt-in. Off suppresses all networking work (compose, send, follow-up).
  networkingEnabled: z.boolean().default(false),
  // Full default so a missing key still yields both autonomy fields (zod does not re-parse defaults).
  autonomy: pilotAutonomySchema.default({ networkingEmail: "review", networkingLinkedIn: "draft" }),
  dailyNetworkingCap: z.number().int().min(0).default(5),
  networkingFollowupDays: z.number().int().default(5),
  // Full default so a missing key still yields a usable promotion block (zod does not re-parse defaults).
  promotion: pilotPromotionConfigSchema.default({ platforms: [], autonomy: "review" }),
  // Boards the user agreed to park; agenda excludes their job.apply items and pilot searches.
  parkedBoards: z.array(z.string()).default([]),
});

export const updatePilotInstructionsSchema = z.object({
  // Goals are mandatory and the pilot's whole steering input: an empty save is rejected.
  goals: z.string().trim().min(1, "Write the pilot's goals before saving."),
  config: pilotInstructionsConfigSchema,
});

export const setPilotEnabledSchema = z.object({ enabled: z.boolean() });

export const pilotStateSchema = z.object({
  userId: z.uuid(),
  enabled: z.boolean(),
  instructionsGoals: z.string(),
  instructionsConfig: pilotInstructionsConfigSchema,
  instructionsUpdatedAt: z.date().nullable(),
  lastCycleAt: z.date().nullable(),
  cycleCount: z.number().int(),
  // Today's applied count (tz-aware) and whether it has reached the instructions' daily cap.
  appliedToday: z.number().int(),
  capReached: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PilotInstructionsConfig = z.infer<typeof pilotInstructionsConfigSchema>;
export type UpdatePilotInstructionsInput = z.infer<typeof updatePilotInstructionsSchema>;
export type SetPilotEnabledInput = z.infer<typeof setPilotEnabledSchema>;
export type PilotState = z.infer<typeof pilotStateSchema>;
