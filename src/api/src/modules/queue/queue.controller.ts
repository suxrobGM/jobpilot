import { addQueueSchema, patchQueueSchema } from "@jobpilot/contracts/queue";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { QueueService } from "./queue.service";

const queueService = container.resolve(QueueService);
const ListQuery = z.object({ status: z.string().trim().min(1).optional() });

export const queueController = new Elysia({ prefix: "/queue", detail: { tags: ["Queue"] } })
  .use(profileGuard)
  .get("/", ({ profileId, query }) => queueService.list(profileId, query.status), {
    query: ListQuery,
  })
  .post("/", ({ profileId, body }) => queueService.add(profileId, body), { body: addQueueSchema })
  .get("/pending", ({ profileId }) => queueService.listPending(profileId))
  .patch(
    "/:id",
    ({ profileId, params, body }) => queueService.patch(profileId, params.id, body),
    { params: idParam, body: patchQueueSchema },
  )
  .delete("/:id", ({ profileId, params }) => queueService.remove(profileId, params.id), {
    params: idParam,
  });
