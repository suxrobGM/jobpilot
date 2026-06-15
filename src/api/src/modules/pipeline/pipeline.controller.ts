import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { pipelineChannel } from "@/common/sse/channels/pipeline";
import { sseResponse, subscribe } from "@/common/sse";
import { PIPELINE_STAGES } from "@/types/pipeline";
import { PipelineService } from "./pipeline.service";

const svc = container.resolve(PipelineService);

const filter = z.string().trim().min(1).nullish().catch(null);

const pipelineQuery = z.object({
  stage: z.enum(PIPELINE_STAGES),
  cursor: z.coerce.number().int().positive().nullish().catch(null),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .catch(50)
    .transform((n) => Math.min(n, 200)),
  search: filter,
  board: filter,
  campaignId: filter,
});

export const pipelineController = new Elysia({
  prefix: "/pipeline",
  detail: { tags: ["Pipeline"] },
})
  .use(profileGuard)
  .get(
    "/",
    ({ profileId, query }) =>
      svc.loadStage(profileId, query.stage, query.cursor ?? null, query.limit, {
        search: query.search ?? null,
        board: query.board ?? null,
        campaignId: query.campaignId ?? null,
      }),
    { query: pipelineQuery },
  )
  .get("/events", ({ profileId }) =>
    sseResponse(subscribe(pipelineChannel, { profileId })),
  );
