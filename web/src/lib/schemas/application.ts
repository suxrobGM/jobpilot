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
export type Stage = z.infer<typeof stageSchema>;

export const APPLICATION_SOURCES = ["apply", "apply-batch", "autopilot", "manual"] as const;
export const sourceSchema = z.enum(APPLICATION_SOURCES);
export type ApplicationSource = z.infer<typeof sourceSchema>;

export const logApplicationSchema = z.object({
  url: z.url(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional().nullable(),
  board: z.string().optional().nullable(),
  source: sourceSchema,
  runId: z.string().optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  matchReason: z.string().optional().nullable(),
  failReason: z.string().optional().nullable(),
});

export type LogApplicationInput = z.infer<typeof logApplicationSchema>;

export const stageTransitionSchema = z.object({
  toStage: stageSchema,
  note: z.string().optional().nullable(),
});

export type StageTransitionInput = z.infer<typeof stageTransitionSchema>;
