import { z } from "zod/v4";
import { webLinkSchema } from "./web-link";

const PILOT_QUESTION_KINDS = ["question", "choice", "2fa", "approval"] as const;
const pilotQuestionKindSchema = z.enum(PILOT_QUESTION_KINDS);

const PILOT_QUESTION_STATUSES = ["open", "answered", "expired", "cancelled"] as const;
const pilotQuestionStatusSchema = z.enum(PILOT_QUESTION_STATUSES);

export const createPilotQuestionSchema = z.object({
  kind: pilotQuestionKindSchema,
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  prompt: z.string().min(1),
  options: z.array(z.string()).default([]),
  deepLink: webLinkSchema.optional(),
  expiresAt: z.iso.datetime().optional(),
});

export const answerPilotQuestionSchema = z.object({ answer: z.string().min(1) });

export const pilotQuestionsQuerySchema = z.object({
  status: pilotQuestionStatusSchema.optional(),
});

export const pilotQuestionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  kind: pilotQuestionKindSchema,
  status: pilotQuestionStatusSchema,
  subjectType: z.string().nullable(),
  subjectId: z.string().nullable(),
  prompt: z.string(),
  options: z.array(z.string()),
  deepLink: z.string().nullable(),
  answer: z.string().nullable(),
  answeredAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export const pilotQuestionListSchema = z.array(pilotQuestionSchema);

export type PilotQuestionKind = z.infer<typeof pilotQuestionKindSchema>;
export type PilotQuestionStatus = z.infer<typeof pilotQuestionStatusSchema>;
export type CreatePilotQuestionInput = z.infer<typeof createPilotQuestionSchema>;
export type AnswerPilotQuestionInput = z.infer<typeof answerPilotQuestionSchema>;
export type PilotQuestion = z.infer<typeof pilotQuestionSchema>;
