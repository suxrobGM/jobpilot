import type { PrismaClient } from "@/generated/prisma/client";
import { GATHER_CAP } from "./constants";
import type { AgendaQuestion } from "./types";

/** Returns answered questions that no active or completed claim has consumed. */
export async function gatherAnsweredQuestions(
  prisma: PrismaClient,
  userId: string,
): Promise<AgendaQuestion[]> {
  const answered = await prisma.pilotQuestion.findMany({
    where: { userId, status: "answered" },
    orderBy: { answeredAt: "desc" },
    take: GATHER_CAP,
    select: {
      id: true,
      kind: true,
      prompt: true,
      subjectType: true,
      subjectId: true,
      answer: true,
    },
  });
  if (answered.length === 0) return [];
  const claims = await prisma.pilotClaim.findMany({
    where: {
      userId,
      subjectType: "question",
      subjectId: { in: answered.map((question) => question.id) },
      OR: [
        { releasedAt: null },
        { releasedAt: { not: null }, outcome: { notIn: ["expired", "abandoned"] } },
      ],
    },
    take: GATHER_CAP,
    select: { subjectId: true },
  });
  const consumed = new Set(claims.map((claim) => claim.subjectId));
  return answered.filter((question) => !consumed.has(question.id));
}
