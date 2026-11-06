import {
  profileAnswerKeyParamSchema,
  profileAnswerListSchema,
  profileAnswerSchema,
  saveProfileAnswerSchema,
} from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import { ProfileAnswerService } from "./answer.service";

const answers = container.get(ProfileAnswerService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const profileAnswersController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/saved-answers", ({ user }) => answers.list(user.id), {
    response: profileAnswerListSchema,
    detail: {
      summary: "List saved answers",
      description:
        "Returns the user's saved answers to reusable questions (relocation, sponsorship, start date), sorted by key.",
    },
  })
  .put(
    "/saved-answers/:key",
    ({ user, params, body }) => answers.save(user.id, params.key, body.value),
    {
      params: profileAnswerKeyParamSchema,
      body: saveProfileAnswerSchema,
      beforeHandle: limitMutation,
      response: profileAnswerSchema,
      detail: {
        summary: "Save an answer",
        description: "Creates or replaces the saved answer for a snake_case key.",
      },
    },
  )
  .delete("/saved-answers/:key", ({ user, params }) => answers.remove(user.id, params.key), {
    params: profileAnswerKeyParamSchema,
    beforeHandle: limitMutation,
    response: okResponseSchema,
    detail: {
      summary: "Delete a saved answer",
      description: "Removes the saved answer, so the agent asks again next time. 404 when absent.",
    },
  });
