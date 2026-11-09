import { z } from "zod/v4";
import {
  NETWORKING_AUTONOMY,
  type NetworkingAutonomy,
  type NetworkingChannel,
  type NetworkingMode,
} from "../networking";
import { pilotJobAlertsSchema } from "./job-alerts";

/** The feed modes plus "off". LinkedIn drops "auto": nothing auto-sends there. */
export const PILOT_EMAIL_AUTONOMY = ["off", ...NETWORKING_AUTONOMY] as const;
export const PILOT_LINKEDIN_AUTONOMY = ["off", "draft", "review"] as const;

// Every channel "off" is how networking is switched off; there is no separate master flag.
export const pilotNetworkingSchema = z.object({
  email: z.enum(PILOT_EMAIL_AUTONOMY).default("off"),
  linkedIn: z.enum(PILOT_LINKEDIN_AUTONOMY).default("off"),
  dailyCap: z.number().int().min(0).default(5),
  followupDays: z.number().int().min(0).default(5),
});

/** What the pilot may apply to; edited through changes. */
const pilotRulesSchema = z.object({
  dailyApplyCap: z.number().int().min(0).default(10),
  minScore: z.number().min(0).max(100).default(60),
  // Rules the pilot screens postings against; the server enforces only the cap and min score.
  dealBreakers: z.array(z.string()).default([]),
  // Ranks H-1B cap-exempt employers higher.
  preferCapExempt: z.boolean().default(false),
});

const pilotSettingsSchema = z.object({
  boards: z.array(z.string()).default([]),
  checkIntervalMinutes: z.number().int().min(5).default(30),
  // `prefault`, not `default`: a missing key is parsed as `{}` so every nested field defaults too.
  networking: pilotNetworkingSchema.prefault({}),
  jobAlerts: pilotJobAlertsSchema.prefault({}),
});

/** Stored as JSON in `PilotState.config`; `{}` parses to a full config. */
export const pilotConfigSchema = pilotRulesSchema.extend(pilotSettingsSchema.shape);

const settings = pilotSettingsSchema.shape;

/** Settings other than job alerts, which keep their own route. */
// Unwrapped: Zod 4 still applies a default under .partial(), so a one-key patch would reset the rest.
export const updatePilotSettingsSchema = z
  .object({
    boards: settings.boards.unwrap(),
    checkIntervalMinutes: settings.checkIntervalMinutes.unwrap(),
    networking: settings.networking.unwrap(),
  })
  .partial();

export const pilotStateSchema = z.object({
  userId: z.uuid(),
  // Autonomous work runs only while on; requests, chat and answered questions always run.
  autopilot: z.boolean(),
  config: pilotConfigSchema,
  lastCycleAt: z.date().nullable(),
  nextWakeAt: z.date().nullable(),
  cycleCount: z.number().int(),
  appliedToday: z.number().int(),
  capReached: z.boolean(),
  networkingSentToday: z.number().int(),
  // A host holds the event stream open; devices that can't probe it locally see it runs.
  agentConnected: z.boolean(),
  // The API refused the user's agent as too old in the last few minutes.
  agentOutdated: z.boolean(),
  // Requests no run has picked up yet.
  pendingRequests: z.number().int(),
  // The newest unfinished, unexpired run.
  currentRun: z
    .object({ id: z.uuid(), taskType: z.string(), title: z.string(), startedAt: z.date() })
    .nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PilotConfig = z.infer<typeof pilotConfigSchema>;
export const setAutopilotSchema = z.object({ enabled: z.boolean() });

export type UpdatePilotSettingsInput = z.infer<typeof updatePilotSettingsSchema>;
export type PilotState = z.infer<typeof pilotStateSchema>;

export function channelAutonomy(
  config: PilotConfig,
  channel: NetworkingChannel,
): NetworkingAutonomy | null {
  const mode = channel === "email" ? config.networking.email : config.networking.linkedIn;
  return mode === "off" ? null : mode;
}

// A warm intro prefers email when both channels are on.
const CHANNEL_PREFERENCE = ["email", "linkedin"] as const satisfies readonly NetworkingChannel[];

export function networkingMode(config: PilotConfig): NetworkingMode | null {
  for (const channel of CHANNEL_PREFERENCE) {
    const autonomy = channelAutonomy(config, channel);
    if (autonomy) {
      return { channel, autonomy };
    }
  }
  return null;
}
