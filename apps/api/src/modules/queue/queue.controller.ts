import { addQueueSchema, patchQueueSchema } from "@jobpilot/contracts/queue";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { deletedResponseSchema } from "@/types/response";
import {
  queueAddedSchema,
  queueEntrySchema,
  queueListQuery,
  queueListSchema,
} from "./queue.schema";
import { QueueService } from "./queue.service";

const queueService = container.resolve(QueueService);

export const queueController = new Elysia({ prefix: "/queue", detail: { tags: ["Queue"] } })
  .use(profileGuard)
  .get("/", ({ profileId, query }) => queueService.list(profileId, query.status), {
    query: queueListQuery,
    response: queueListSchema,
    detail: {
      summary: "List queue entries",
      description:
        "Returns the profile's job-URL queue entries ordered by creation time, optionally filtered by the given status.",
    },
  })
  .post("/", ({ profileId, body }) => queueService.add(profileId, body), {
    body: addQueueSchema,
    response: queueAddedSchema,
    detail: {
      summary: "Add queue entries",
      description:
        "Upserts the supplied job URLs into the profile's queue as pending entries, publishes a queue-updated event, and returns the inserted count with the created entries.",
    },
  })
  .get("/pending", ({ profileId }) => queueService.listPending(profileId), {
    response: queueListSchema,
    detail: {
      summary: "List pending entries",
      description:
        "Returns the profile's queue entries whose status is pending, ordered by creation time.",
    },
  })
  .patch("/:id", ({ profileId, params, body }) => queueService.patch(profileId, params.id, body), {
    params: idParam,
    body: patchQueueSchema,
    response: queueEntrySchema,
    detail: {
      summary: "Update queue entry status",
      description:
        "Updates the status of the profile's queue entry, setting consumedAt when transitioning to consumed and clearing it otherwise, and returns the updated entry.",
    },
  })
  .delete("/:id", ({ profileId, params }) => queueService.remove(profileId, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete queue entry",
      description:
        "Deletes the profile's queue entry by id and returns the id of the removed entry.",
    },
  });
