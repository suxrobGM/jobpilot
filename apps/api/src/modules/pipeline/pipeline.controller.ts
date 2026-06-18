import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { sseStream } from "@/common/sse";
import { pipelineChannel } from "@/common/sse/channels/pipeline";
import { pipelineColumnPageSchema, pipelineQuery } from "./pipeline.schema";
import { PipelineService } from "./pipeline.service";

const svc = container.resolve(PipelineService);

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
    {
      query: pipelineQuery,
      response: pipelineColumnPageSchema,
      detail: {
        summary: "List pipeline stage",
        description:
          "Returns one paginated Kanban stage column for the active profile, aggregating queue, job, and application records filtered by the requested stage and optional search, board, and campaign criteria.",
      },
    },
  )
  .get("/events", ({ profileId, headers }) => sseStream(pipelineChannel, { profileId }, headers), {
    detail: {
      summary: "Stream pipeline events",
      description:
        "Opens a Server-Sent Events stream that pushes live pipeline updates for the active profile, returning a raw streaming Response that stays open until the client disconnects.",
    },
  });
