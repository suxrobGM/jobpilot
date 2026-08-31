import {
  answerPilotQuestionSchema,
  createPilotQuestionSchema,
  pilotQuestionListSchema,
  pilotQuestionSchema,
  pilotQuestionsQuerySchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { PilotQuestionService } from "./pilot.questions.service";

const questions = container.resolve(PilotQuestionService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotQuestionsController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .post("/questions", ({ user, body }) => questions.createQuestion(user.id, body), {
    body: createPilotQuestionSchema,
    beforeHandle: limitMutation,
    response: pilotQuestionSchema,
    detail: {
      summary: "Create a question",
      description: "Opens a question/choice/2fa/approval question and notifies subscribers.",
    },
  })
  .get("/questions", ({ user, query }) => questions.listQuestions(user.id, query.status), {
    query: pilotQuestionsQuerySchema,
    response: pilotQuestionListSchema,
    detail: {
      summary: "List questions",
      description: "Returns the profile's questions, optionally filtered by status.",
    },
  })
  .post(
    "/questions/:id/answer",
    ({ user, params, body }) => questions.answerQuestion(user.id, params.id, body),
    {
      params: idParam,
      body: answerPilotQuestionSchema,
      beforeHandle: limitMutation,
      response: pilotQuestionSchema,
      detail: {
        summary: "Answer a question",
        description: "Records the answer, marks the question answered, and notifies subscribers.",
      },
    },
  );
