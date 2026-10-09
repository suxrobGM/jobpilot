import { z } from "zod/v4";
import { answerKeySchema } from "./answers";
import { webLinkSchema } from "./web-link";

export const PILOT_QUESTION_KINDS = ["question", "choice", "two_factor", "approval"] as const;
const pilotQuestionKindSchema = z.enum(PILOT_QUESTION_KINDS);

export const PILOT_QUESTION_STATUSES = ["open", "answered", "expired", "cancelled"] as const;
const pilotQuestionStatusSchema = z.enum(PILOT_QUESTION_STATUSES);

export const createPilotQuestionSchema = z.object({
  kind: pilotQuestionKindSchema,
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  prompt: z.string().min(1),
  options: z.array(z.string()).default([]),
  deepLink: webLinkSchema.optional(),
  expiresAt: z.iso.datetime().optional(),
  // Set only for a reusable fact, so answering it saves a profile answer.
  answerKey: answerKeySchema.optional(),
});

export const answerPilotQuestionSchema = z.object({
  answer: z.string().min(1),
  // `answer` is then the user's instructions, and the pilot writes the real answer from them.
  writeForMe: z.boolean().default(false),
});

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
  writeForMe: z.boolean(),
  answerKey: answerKeySchema.nullable(),
  answeredAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export const pilotQuestionListSchema = z.array(pilotQuestionSchema);

export type PilotQuestionStatus = z.infer<typeof pilotQuestionStatusSchema>;
export type CreatePilotQuestionInput = z.infer<typeof createPilotQuestionSchema>;
export type AnswerPilotQuestionInput = z.infer<typeof answerPilotQuestionSchema>;
export type PilotQuestion = z.infer<typeof pilotQuestionSchema>;
