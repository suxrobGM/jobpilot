import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { fitResultSchema, scoreFitSchema } from "./scoring.schema";
import { ScoringService } from "./scoring.service";

const scoringService = container.resolve(ScoringService);

export const scoringController = new Elysia({
  prefix: "/score-fit",
  detail: { tags: ["Scoring"] },
})
  .use(authGuard)
  .post("/", ({ user, body }) => scoringService.scoreJobFit(user.id, body), {
    body: scoreFitSchema,
    response: fitResultSchema,
    detail: {
      summary: "Score job fit",
      description:
        "Deterministically scores a job digest against the profile's resume-derived inputs plus any overrides. The verdict says whether to trust the score as-is or deliberate over the match evidence.",
    },
  });
