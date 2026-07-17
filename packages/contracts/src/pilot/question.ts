import { z } from "zod/v4";
import { webLinkSchema } from "./web-link";

// ── Questions ─────────────────────────────────────────────────────────────────

const QUESTION_KINDS = ["question", "choice", "2fa", "approval"] as const;
const questionKindSchema = z.enum(QUESTION_KINDS);

const QUESTION_STATUSES = ["open", "answered", "expired", "cancelled"] as const;
const questionStatusSchema = z.enum(QUESTION_STATUSES);

export const createQuestionSchema = z.object({
  kind: questionKindSchema,
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  prompt: z.string().min(1),
  options: z.array(z.string()).default([]),
  deepLink: webLinkSchema.optional(),
  expiresAt: z.iso.datetime().optional(),
});

export const answerQuestionSchema = z.object({ answer: z.string().min(1) });

export const questionsQuerySchema = z.object({ status: questionStatusSchema.optional() });

export const questionSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  kind: questionKindSchema,
  status: questionStatusSchema,
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

export const questionListSchema = z.array(questionSchema);

export type QuestionKind = z.infer<typeof questionKindSchema>;
export type QuestionStatus = z.infer<typeof questionStatusSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;
export type Question = z.infer<typeof questionSchema>;
