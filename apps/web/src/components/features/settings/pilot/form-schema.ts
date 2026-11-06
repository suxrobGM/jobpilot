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
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

/** Shared `defaultValues` the withForm sections type against; real values come from pilot state. */
export const SETTINGS_FORM_DEFAULTS: SettingsFormValues = {
  checkIntervalMinutes: 30,
  networking: pilotNetworkingSchema.parse({}),
};

export function toSettings(value: SettingsFormValues): UpdatePilotSettingsInput {
  return {
    checkIntervalMinutes: value.checkIntervalMinutes,
    networking: value.networking,
  };
}

export function toFormValues(state: PilotState): SettingsFormValues {
  const c = state.config;
  return {
    checkIntervalMinutes: c.checkIntervalMinutes,
    networking: { ...c.networking },
  };
}
