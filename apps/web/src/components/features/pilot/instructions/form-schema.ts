import { z } from "zod/v4";

export const instructionsFormSchema = z.object({
  goals: z.string(),
  dailyApplyCap: z.number().int().min(0),
  dailyNetworkingCap: z.number().int().min(0),
  networkingFollowupDays: z.number().int().min(0),
  minScore: z.number().min(0).max(100),
  checkIntervalMinutes: z.number().int().min(1),
  networkingEnabled: z.boolean(),
  networkingEmail: z.enum(["draft", "review", "auto"]),
  networkingLinkedIn: z.enum(["draft", "review"]),
  boards: z.array(z.string()),
  parkedBoards: z.array(z.string()),
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
  dailyNetworkingCap: 5,
  networkingFollowupDays: 5,
  minScore: 60,
  checkIntervalMinutes: 30,
  networkingEnabled: false,
  networkingEmail: "review",
  networkingLinkedIn: "draft",
  boards: [],
  parkedBoards: [],
  promotionPlatforms: [],
};
