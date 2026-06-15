import { jobBoardPatchSchema, jobBoardSchema } from "@jobpilot/contracts/job-board";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { JobBoardsService } from "./job-boards.service";

const svc = container.resolve(JobBoardsService);

export const jobBoardsController = new Elysia({
  prefix: "/job-boards",
  detail: { tags: ["Job Boards"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => svc.list(profileId))
  .post("/", ({ profileId, body }) => svc.create(profileId, body), { body: jobBoardSchema })
  .patch(
    "/:id",
    ({ profileId, params, body }) => svc.update(profileId, params.id, body),
    { params: idParam, body: jobBoardPatchSchema },
  )
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
  });
