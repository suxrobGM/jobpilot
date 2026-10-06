import {
  answerPilotQuestionSchema,
  createPilotQuestionSchema,
  pilotQuestionListSchema,
  pilotQuestionSchema,
  pilotQuestionsQuerySchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { PilotQuestionService } from "./question.service";

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
  )
  .post(
    "/questions/:id/skip-application",
    ({ user, params }) => questions.skipApplication(user.id, params.id),
    {
      params: idParam,
      beforeHandle: limitMutation,
      response: pilotQuestionSchema,
      detail: {
        summary: "Skip the question's application",
        description:
          "Records the question's job as skipped by the user, journals it, and cancels every open question on that job.",
      },
    },
  )
  .post("/questions/:id/skip", ({ user, params }) => questions.skipQuestion(user.id, params.id), {
    params: idParam,
    beforeHandle: limitMutation,
    response: pilotQuestionSchema,
    detail: {
      summary: "Skip a question",
      description:
        "Cancels the question (and its siblings on the same subject) and requeues a parked job so the pilot retries without an answer.",
    },
  });
