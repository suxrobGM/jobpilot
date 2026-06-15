import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { fitProfileSchema, jobDigestSchema } from "./fit";
import { ScoringService } from "./scoring.service";

const scoreFitSchema = z.object({
  digest: jobDigestSchema,
  profile: fitProfileSchema.partial().optional(),
});

const scoringService = container.resolve(ScoringService);

export const scoringController = new Elysia({
  prefix: "/score-fit",
  detail: { tags: ["Scoring"] },
})
  .use(profileGuard)
  .post("/", ({ profileId, body }) => scoringService.scoreJobFit(profileId, body), {
    body: scoreFitSchema,
  });
