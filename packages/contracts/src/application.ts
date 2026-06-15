import { z } from "zod/v4";

export const STAGES = [
  "applied",
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export const stageSchema = z.enum(STAGES);
export const APPLICATION_SOURCES = ["apply", "auto-apply", "manual"] as const;
export const sourceSchema = z.enum(APPLICATION_SOURCES);

export const stageTransitionSchema = z.object({
  toStage: stageSchema,
  note: z.string().optional().nullable(),
});

export type Stage = z.infer<typeof stageSchema>;
export type ApplicationSource = z.infer<typeof sourceSchema>;
export type StageTransitionInput = z.infer<typeof stageTransitionSchema>;
