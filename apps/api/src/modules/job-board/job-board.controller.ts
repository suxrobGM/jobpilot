import { jobBoardPatchSchema, jobBoardSchema } from "@jobpilot/contracts/job-board";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { JobBoardService } from "./job-board.service";

const svc = container.resolve(JobBoardService);

export const jobBoardController = new Elysia({
  prefix: "/job-boards",
  detail: { tags: ["Job Boards"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => svc.list(profileId), {
    detail: {
      summary: "List job boards",
      description:
        "Returns all saved job boards owned by the active profile, ordered by their sort order.",
    },
  })
  .post("/", ({ profileId, body }) => svc.create(profileId, body), {
    body: jobBoardSchema,
    detail: {
      summary: "Create job board",
      description:
        "Creates a new job board for the active profile from the request body and returns the created record.",
    },
  })
  .patch(
    "/:id",
    ({ profileId, params, body }) => svc.update(profileId, params.id, body),
    {
      params: idParam,
      body: jobBoardPatchSchema,
      detail: {
        summary: "Update job board",
        description:
          "Applies a partial update to the active profile's job board identified by id and returns the updated record.",
      },
    },
  )
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Delete job board",
      description:
        "Deletes the active profile's job board identified by id and returns the id of the removed record.",
    },
  });
