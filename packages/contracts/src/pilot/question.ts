import { z } from "zod/v4";
import { savedAnswerKeySchema } from "./answers";
import { pilotSubjectTypeSchema } from "./tasks";
import { webLinkSchema } from "./web-link";

export const PILOT_QUESTION_KINDS = ["question", "choice", "two_factor", "approval"] as const;
const pilotQuestionKindSchema = z.enum(PILOT_QUESTION_KINDS);

export const PILOT_QUESTION_STATUSES = ["open", "answered", "expired", "cancelled"] as const;
const pilotQuestionStatusSchema = z.enum(PILOT_QUESTION_STATUSES);

export const createPilotQuestionSchema = z.object({
  kind: pilotQuestionKindSchema,
  subjectType: pilotSubjectTypeSchema.optional(),
  subjectId: z.string().optional(),
  prompt: z.string().min(1),
  options: z.array(z.string()).default([]),
  link: webLinkSchema.optional(),
  expiresAt: z.iso.datetime().optional(),
  // Set only for a reusable fact, so answering it saves a profile answer.
  savedAnswerKey: savedAnswerKeySchema.optional(),
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
  subjectType: pilotSubjectTypeSchema.nullable(),
  subjectId: z.string().nullable(),
  prompt: z.string(),
  options: z.array(z.string()),
  link: z.string().nullable(),
  answer: z.string().nullable(),
  savedAnswerKey: savedAnswerKeySchema.nullable(),
  answeredAt: z.date().nullable(),
  expiresAt: z.date(),
  createdAt: z.date(),
});

export const pilotQuestionListSchema = z.array(pilotQuestionSchema);

export type PilotQuestionStatus = z.infer<typeof pilotQuestionStatusSchema>;
export type CreatePilotQuestionInput = z.infer<typeof createPilotQuestionSchema>;
export type AnswerPilotQuestionInput = z.infer<typeof answerPilotQuestionSchema>;
export type PilotQuestion = z.infer<typeof pilotQuestionSchema>;
