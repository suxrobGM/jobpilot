import { z } from "zod/v4";

// ── Escalations ───────────────────────────────────────────────────────────────

const ESCALATION_KINDS = ["question", "choice", "2fa", "approval"] as const;
const escalationKindSchema = z.enum(ESCALATION_KINDS);

const ESCALATION_STATUSES = ["open", "answered", "expired", "cancelled"] as const;
const escalationStatusSchema = z.enum(ESCALATION_STATUSES);

export const createEscalationSchema = z.object({
  kind: escalationKindSchema,
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  question: z.string().min(1),
  options: z.array(z.string()).default([]),
  deepLink: z.string().optional(),
  expiresAt: z.iso.datetime().optional(),
});

export const answerEscalationSchema = z.object({ answer: z.string().min(1) });

export const escalationsQuerySchema = z.object({ status: escalationStatusSchema.optional() });

export const escalationSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  kind: escalationKindSchema,
  status: escalationStatusSchema,
  subjectType: z.string().nullable(),
  subjectId: z.string().nullable(),
  question: z.string(),
  options: z.array(z.string()),
  deepLink: z.string().nullable(),
  answer: z.string().nullable(),
  answeredAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export const escalationListSchema = z.array(escalationSchema);

export type EscalationKind = z.infer<typeof escalationKindSchema>;
export type EscalationStatus = z.infer<typeof escalationStatusSchema>;
export type CreateEscalationInput = z.infer<typeof createEscalationSchema>;
export type AnswerEscalationInput = z.infer<typeof answerEscalationSchema>;
export type Escalation = z.infer<typeof escalationSchema>;
