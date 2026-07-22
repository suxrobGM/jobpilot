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
import { PilotService } from "./pilot.service";

const pilot = container.resolve(PilotService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

// Self-contained `/pilot` group mounted standalone in app.ts, like the other pilot controllers.
export const pilotQuestionsController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .post("/questions", ({ user, body }) => pilot.createQuestion(user.id, body), {
    body: createPilotQuestionSchema,
    beforeHandle: limitMutation,
    response: pilotQuestionSchema,
    detail: {
      summary: "Create a question",
      description: "Opens a question/choice/2fa/approval question and notifies subscribers.",
    },
  })
  .get("/questions", ({ user, query }) => pilot.listQuestions(user.id, query.status), {
    query: pilotQuestionsQuerySchema,
    response: pilotQuestionListSchema,
    detail: {
      summary: "List questions",
      description: "Returns the profile's questions, optionally filtered by status.",
    },
  })
  .post(
    "/questions/:id/answer",
    ({ user, params, body }) => pilot.answerQuestion(user.id, params.id, body),
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
