import { z } from "zod/v4";
import {
  NETWORKING_AUTONOMY,
  type NetworkingAutonomy,
  type NetworkingChannel,
  type NetworkingMode,
} from "../networking";

/** The campaign modes plus "off". LinkedIn drops "auto": nothing auto-sends there. */
export const PILOT_EMAIL_AUTONOMY = ["off", ...NETWORKING_AUTONOMY] as const;
export const PILOT_LINKEDIN_AUTONOMY = ["off", "draft", "review"] as const;

// Every channel "off" is how networking is switched off; there is no separate master flag.
export const pilotNetworkingSchema = z.object({
  email: z.enum(PILOT_EMAIL_AUTONOMY).default("off"),
  linkedIn: z.enum(PILOT_LINKEDIN_AUTONOMY).default("off"),
  dailyCap: z.number().int().min(0).default(5),
  followupDays: z.number().int().min(0).default(5),
});

const pilotPromotionPlatformSchema = z.object({
  platform: z.string().min(1),
  target: z.string().optional(),
  postEveryDays: z.number().int().min(1).default(30),
});

/** Review-only: auto-posting is deliberately not offered. */
const pilotPromotionConfigSchema = z.object({
  platforms: z.array(pilotPromotionPlatformSchema).default([]),
  autonomy: z.literal("review").default("review"),
});

/** One per Playwright MCP server in `plugin/.mcp.json`: `playwright`, `playwright-2`, `playwright-3`. */
export const MAX_CONCURRENT_APPLIES = 3;

/** Stored as JSON in `PilotState.instructionsConfig`; `{}` parses to a full config. */
export const pilotInstructionsConfigSchema = z.object({
  dailyApplyCap: z.number().int().min(0).default(10),
  /**
   * Applies run side by side in one batch run, each in its own browser profile. Bounded by the
   * browsers `plugin/.mcp.json` declares. Parallel submissions from one identity look less human
   * than a serial trickle, so raise it a step at a time.
   */
  maxConcurrentApplies: z.number().int().min(1).max(MAX_CONCURRENT_APPLIES).default(1),
  minScore: z.number().min(0).max(100).default(60),
  boards: z.array(z.string()).default([]),
  checkIntervalMinutes: z.number().int().min(5).default(30),
  // `prefault`, not `default`: a missing key is parsed as `{}` so every nested field defaults too.
  networking: pilotNetworkingSchema.prefault({}),
  promotion: pilotPromotionConfigSchema.prefault({}),
});

/** What to retire from the old goals. Nothing by default, so the web asks before sending any. */
export const pilotInstructionsChangeSchema = z.object({
  // `search.setup` only runs once no searches exist, so deleting them is what re-derives.
  rederiveSearches: z.boolean().default(false),
  completeCampaigns: z.boolean().default(false),
  dropApprovedJobs: z.boolean().default(false),
});

export const NO_INSTRUCTIONS_CHANGE: PilotInstructionsChange = pilotInstructionsChangeSchema.parse(
  {},
);

export const updatePilotInstructionsSchema = z.object({
  goals: z.string().trim().min(1, "Write the pilot's goals before saving."),
  config: pilotInstructionsConfigSchema,
  onChange: pilotInstructionsChangeSchema.prefault({}),
});

export const pilotInstructionsImpactSchema = z.object({
  searches: z.array(z.object({ id: z.uuid(), query: z.string(), reason: z.string() })),
  campaigns: z.array(
    z.object({ campaignId: z.uuid(), query: z.string(), approvedJobs: z.number().int() }),
  ),
  approvedJobs: z.number().int(),
  oldestApprovedAt: z.date().nullable(),
});

export const pilotStateSchema = z.object({
  userId: z.uuid(),
  running: z.boolean(),
  instructionsGoals: z.string(),
  instructionsConfig: pilotInstructionsConfigSchema,
  instructionsUpdatedAt: z.date().nullable(),
  lastCycleAt: z.date().nullable(),
  nextWakeAt: z.date().nullable(),
  cycleCount: z.number().int(),
  appliedToday: z.number().int(),
  capReached: z.boolean(),
  networkingSentToday: z.number().int(),
  // The newest unfinished, unexpired run.
  currentRun: z.object({ id: z.uuid(), taskType: z.string(), startedAt: z.date() }).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PilotInstructionsConfig = z.infer<typeof pilotInstructionsConfigSchema>;
export type PilotInstructionsChange = z.infer<typeof pilotInstructionsChangeSchema>;
export type PilotInstructionsImpact = z.infer<typeof pilotInstructionsImpactSchema>;
export type UpdatePilotInstructionsInput = z.infer<typeof updatePilotInstructionsSchema>;
export type PilotState = z.infer<typeof pilotStateSchema>;

/** How one channel runs, or null when it is off. */
export function channelAutonomy(
  config: PilotInstructionsConfig,
  channel: NetworkingChannel,
): NetworkingAutonomy | null {
  const mode = channel === "email" ? config.networking.email : config.networking.linkedIn;
  return mode === "off" ? null : mode;
}

// A warm intro prefers email when both channels are on.
const CHANNEL_PREFERENCE = ["email", "linkedin"] as const satisfies readonly NetworkingChannel[];

/** How a new outreach message goes out, or null when every channel is off. */
export function networkingMode(config: PilotInstructionsConfig): NetworkingMode | null {
  for (const channel of CHANNEL_PREFERENCE) {
    const autonomy = channelAutonomy(config, channel);
    if (autonomy) return { channel, autonomy };
  }
  return null;
}
