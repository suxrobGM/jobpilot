import { z } from "zod/v4";

// ── Mandate ───────────────────────────────────────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const pilotActiveHoursSchema = z.object({
  start: z.string().regex(HHMM),
  end: z.string().regex(HHMM),
  tz: z.string(),
});

const pilotStandingQuerySchema = z.object({
  query: z.string().min(1),
  board: z.string().optional(),
  // Base resume the discovered campaign scores against; campaign config requires it.
  resumeId: z.string().optional(),
  cadenceHours: z.number().default(24),
});

const pilotAutonomySchema = z.object({
  outreachEmail: z.enum(["draft", "review", "auto"]).default("review"),
  outreachLinkedIn: z.enum(["draft", "review"]).default("draft"),
});

const pilotPromotionVenueSchema = z.object({
  venue: z.string().min(1),
  target: z.string().optional(),
  cadenceDays: z.number().int().min(1).default(30),
});

/** Self-promotion config. Review-only in M3: auto-posting is deliberately not offered. */
const pilotPromotionConfigSchema = z.object({
  venues: z.array(pilotPromotionVenueSchema).default([]),
  autonomy: z.literal("review").default("review"),
});

/**
 * The Pilot's operating envelope, stored as JSON in `PilotState.mandateConfig`.
 * Every field defaults, so an empty `{}` parses to a full, usable config.
 */
export const pilotMandateConfigSchema = z.object({
  dailyApplyCap: z.number().int().min(0).default(10),
  minScore: z.number().min(0).max(100).default(70),
  boards: z.array(z.string()).default([]),
  activeHours: pilotActiveHoursSchema.optional(),
  checkIntervalMinutes: z.number().int().default(30),
  standingQueries: z.array(pilotStandingQuerySchema).default([]),
  // Full default so a missing key still yields both autonomy fields (zod does not re-parse defaults).
  autonomy: pilotAutonomySchema.default({ outreachEmail: "review", outreachLinkedIn: "draft" }),
  dailyOutreachCap: z.number().int().min(0).default(5),
  outreachFollowupDays: z.number().int().default(5),
  // Full default so a missing key still yields a usable promotion block (zod does not re-parse defaults).
  promotion: pilotPromotionConfigSchema.default({ venues: [], autonomy: "review" }),
  // Boards the user agreed to park; agenda excludes their job.apply items and standing queries.
  parkedBoards: z.array(z.string()).default([]),
});

export const updatePilotMandateSchema = z.object({
  goals: z.string(),
  config: pilotMandateConfigSchema,
});

export const setPilotEnabledSchema = z.object({ enabled: z.boolean() });

export const pilotStateSchema = z.object({
  profileId: z.uuid(),
  enabled: z.boolean(),
  mandateGoals: z.string(),
  mandateConfig: pilotMandateConfigSchema,
  mandateUpdatedAt: z.date().nullable(),
  lastCycleAt: z.date().nullable(),
  cycleCount: z.number().int(),
  // Today's applied count (tz-aware) and whether it has reached the mandate's daily cap.
  appliedToday: z.number().int(),
  capReached: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PilotMandateConfig = z.infer<typeof pilotMandateConfigSchema>;
export type UpdatePilotMandateInput = z.infer<typeof updatePilotMandateSchema>;
export type SetPilotEnabledInput = z.infer<typeof setPilotEnabledSchema>;
export type PilotState = z.infer<typeof pilotStateSchema>;
