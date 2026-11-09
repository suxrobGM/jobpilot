import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { NOT_SETTLED } from "../../questions/settled-answers";
import { GATHER_CAP, withoutConsumingRuns } from "../../runs/run-history";
import type { GatherContext } from "./gather-context";

/** Answered questions no open or finished run has consumed yet. */
export async function gatherAnsweredQuestions(
  ctx: GatherContext,
): Promise<TaskPayload<"question.answered">[]> {
  const { prisma, userId } = ctx;
  const answered = await prisma.pilotQuestion.findMany({
    where: { userId, status: "answered", ...NOT_SETTLED },
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
    ctx,
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
