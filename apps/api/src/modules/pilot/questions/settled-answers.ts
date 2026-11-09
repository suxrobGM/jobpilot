import type { PilotQuestion, Prisma } from "@/generated/prisma/client";

/** Answers the API applies itself, so they never start an agent run. */
const SETTLED_ANSWERS = [
  { subjectType: "job", answer: "Skip" },
  { subjectType: "email", answer: "Skip" },
  { subjectType: "networking", answer: "Skip" },
  { subjectType: "feed", answer: "Keep paused" },
] satisfies Prisma.PilotQuestionWhereInput[];

export const NOT_SETTLED = { NOT: SETTLED_ANSWERS } satisfies Prisma.PilotQuestionWhereInput;

export function isSettledAnswer(question: Pick<PilotQuestion, "subjectType" | "answer">): boolean {
  return SETTLED_ANSWERS.some(
    (settled) => settled.subjectType === question.subjectType && settled.answer === question.answer,
  );
}
