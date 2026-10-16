import {
  MAX_CONCURRENT_APPLIES,
  PILOT_EMAIL_AUTONOMY,
  PILOT_LINKEDIN_AUTONOMY,
  type PilotInstructionsConfig,
  type PilotState,
  pilotNetworkingSchema,
} from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";

export const instructionsFormSchema = z.object({
  goals: z.string().trim().min(1, "Required"),
  dailyApplyCap: z.number().int().min(0),
  maxConcurrentApplies: z.number().int().min(1).max(MAX_CONCURRENT_APPLIES),
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
  maxConcurrentApplies: 1,
  minScore: 60,
  checkIntervalMinutes: 30,
  networking: pilotNetworkingSchema.parse({}),
  boards: [],
  promotionPlatforms: [],
};

export function toConfig(value: InstructionsFormValues): PilotInstructionsConfig {
  return {
    dailyApplyCap: value.dailyApplyCap,
    maxConcurrentApplies: value.maxConcurrentApplies,
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
    maxConcurrentApplies: c.maxConcurrentApplies,
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
