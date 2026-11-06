import {
  PILOT_EMAIL_AUTONOMY,
  PILOT_LINKEDIN_AUTONOMY,
  type PilotState,
  pilotNetworkingSchema,
  type UpdatePilotSettingsInput,
} from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";

export const settingsFormSchema = z.object({
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

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

/** Shared `defaultValues` the withForm sections type against; real values come from pilot state. */
export const SETTINGS_FORM_DEFAULTS: SettingsFormValues = {
  checkIntervalMinutes: 30,
  networking: pilotNetworkingSchema.parse({}),
  boards: [],
  promotionPlatforms: [],
};

export function toSettings(value: SettingsFormValues): UpdatePilotSettingsInput {
  return {
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

export function toFormValues(state: PilotState): SettingsFormValues {
  const c = state.config;
  return {
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
