import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { fitResultSchema, scoreFitSchema } from "./scoring.schema";
import { ScoringService } from "./scoring.service";

const scoringService = container.resolve(ScoringService);

export const scoringController = new Elysia({
  prefix: "/score-fit",
  detail: { tags: ["Scoring"] },
})
  .use(profileGuard)
  .post("/", ({ profileId, body }) => scoringService.scoreJobFit(profileId, body), {
    body: scoreFitSchema,
    response: fitResultSchema,
    detail: {
      summary: "Score job fit",
      description:
        "Deterministically scores a job digest against the active profile's resume-derived inputs plus any provided overrides and returns the computed fit result.",
    },
  });
