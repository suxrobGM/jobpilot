import {
  PILOT_EMAIL_AUTONOMY,
  PILOT_LINKEDIN_AUTONOMY,
  type PilotInstructionsConfig,
  type PilotState,
  pilotInstructionsConfigSchema,
  pilotNetworkingSchema,
} from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";

export const instructionsFormSchema = z.object({
  goals: z.string().trim().min(1, "Required"),
  dailyApplyCap: z.number().int().min(0),
  minScore: z.number().min(0).max(100),
  checkIntervalMinutes: z.number().int().min(5),
  // Mirrors the config block so the section addresses its fields by their real path. Spelled out
  // rather than reusing pilotNetworkingSchema, whose defaults make every key optional on input.
  networking: z.object({
    email: z.enum(PILOT_EMAIL_AUTONOMY),
    linkedIn: z.enum(PILOT_LINKEDIN_AUTONOMY),
    dailyCap: z.number().int().min(0),
    followupDays: z.number().int().min(0),
  }),
  boards: z.array(z.string()),
  promotionPlatforms: z.array(
    z.object({
      platform: z.string().min(1, "Required"),
      target: z.string(),
      postEveryDays: z.number().min(1),
    }),
  ),
});

export type InstructionsFormValues = z.infer<typeof instructionsFormSchema>;

/** Shared `defaultValues` the withForm sections type against; real values come from pilot state. */
export const INSTRUCTIONS_FORM_DEFAULTS: InstructionsFormValues = {
  goals: "",
  dailyApplyCap: 10,
  minScore: 60,
  checkIntervalMinutes: 30,
  networking: pilotNetworkingSchema.parse({}),
  boards: [],
  promotionPlatforms: [],
};

export function toConfig(value: InstructionsFormValues): PilotInstructionsConfig {
  return {
    dailyApplyCap: value.dailyApplyCap,
    minScore: value.minScore,
    checkIntervalMinutes: value.checkIntervalMinutes,
    boards: value.boards,
    networking: value.networking,
    promotion: {
      platforms: value.promotionPlatforms.map((p) => ({
        platform: p.platform.trim(),
        target: p.target.trim() || undefined,
        postEveryDays: p.postEveryDays,
      })),
      autonomy: "review",
    },
  };
}

export function toFormValues(state: PilotState): InstructionsFormValues {
  const c = state.instructionsConfig;
  return {
    goals: state.instructionsGoals,
    dailyApplyCap: c.dailyApplyCap,
    minScore: c.minScore,
    checkIntervalMinutes: c.checkIntervalMinutes,
    networking: { ...c.networking },
    boards: [...c.boards],
    promotionPlatforms: c.promotion.platforms.map((p) => ({
      platform: p.platform,
      target: p.target ?? "",
      postEveryDays: p.postEveryDays,
    })),
  };
}

/** A config indistinguishable from `{}` means the user never tuned anything. */
const DEFAULT_CONFIG_JSON = JSON.stringify(pilotInstructionsConfigSchema.parse({}));

export function hasTunedConfig(state: PilotState): boolean {
  return JSON.stringify(state.instructionsConfig) !== DEFAULT_CONFIG_JSON;
}
