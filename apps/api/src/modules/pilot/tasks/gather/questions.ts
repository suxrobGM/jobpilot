import type { TaskPayload } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { GATHER_CAP, withoutConsumingRuns } from "../../runs/run-history";

/** Answered questions no open or finished run has consumed yet. */
export async function gatherAnsweredQuestions(
  prisma: PrismaClient,
  userId: string,
): Promise<TaskPayload<"question.answered">[]> {
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
  const open = await withoutConsumingRuns(
    prisma,
    userId,
    "question.answered",
    answered,
    (question) => question.id,
  );
  return open.map(({ id, kind, ...question }) => ({
    ...question,
    questionId: id,
    questionKind: kind,
  }));
}
