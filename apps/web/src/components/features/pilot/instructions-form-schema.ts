import { z } from "zod/v4";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const instructionsFormSchema = z.object({
  goals: z.string(),
  dailyApplyCap: z.number().int().min(0),
  dailyOutreachCap: z.number().int().min(0),
  outreachFollowupDays: z.number().int().min(0),
  minScore: z.number().min(0).max(100),
  checkIntervalMinutes: z.number().int().min(1),
  activeHoursEnabled: z.boolean(),
  activeHoursStart: z.string().regex(HHMM, "Use HH:MM"),
  activeHoursEnd: z.string().regex(HHMM, "Use HH:MM"),
  activeHoursTz: z.string(),
  outreachEmail: z.enum(["draft", "review", "auto"]),
  outreachLinkedIn: z.enum(["draft", "review"]),
  savedSearches: z.array(
    z.object({
      query: z.string().min(1, "Required"),
      board: z.string(),
      cadenceHours: z.number().min(1),
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
