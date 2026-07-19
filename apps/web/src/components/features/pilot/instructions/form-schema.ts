import { HHMM_PATTERN } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";

export const instructionsFormSchema = z.object({
  goals: z.string(),
  dailyApplyCap: z.number().int().min(0),
  dailyOutreachCap: z.number().int().min(0),
  outreachFollowupDays: z.number().int().min(0),
  minScore: z.number().min(0).max(100),
  checkIntervalMinutes: z.number().int().min(1),
  outreachEnabled: z.boolean(),
  activeHoursEnabled: z.boolean(),
  activeHoursStart: z.string().regex(HHMM_PATTERN, "Use HH:MM"),
  activeHoursEnd: z.string().regex(HHMM_PATTERN, "Use HH:MM"),
  activeHoursTz: z.string(),
  outreachEmail: z.enum(["draft", "review", "auto"]),
  outreachLinkedIn: z.enum(["draft", "review"]),
  boards: z.array(z.string()),
  parkedBoards: z.array(z.string()),
  savedSearches: z.array(
    z.object({
      query: z.string().min(1, "Required"),
      board: z.string(),
      cadenceHours: z.number().min(1),
      // No UI field; carried through because the instructions PUT is a full replace and would erase it.
      resumeId: z.string().optional(),
    }),
  ),
  promotionPlatforms: z.array(
    z.object({
      platform: z.string().min(1, "Required"),
      target: z.string(),
      cadenceDays: z.number().min(1),
    }),
  ),
});

export type InstructionsFormValues = z.infer<typeof instructionsFormSchema>;

/** Shared `defaultValues` the withForm sections type against; real values come from pilot state. */
export const INSTRUCTIONS_FORM_DEFAULTS: InstructionsFormValues = {
  goals: "",
  dailyApplyCap: 10,
  dailyOutreachCap: 5,
  outreachFollowupDays: 5,
  minScore: 60,
  checkIntervalMinutes: 30,
  outreachEnabled: false,
  activeHoursEnabled: false,
  activeHoursStart: "09:00",
  activeHoursEnd: "17:00",
  activeHoursTz: "UTC",
  outreachEmail: "review",
  outreachLinkedIn: "draft",
  boards: [],
  parkedBoards: [],
  savedSearches: [],
  promotionPlatforms: [],
};
