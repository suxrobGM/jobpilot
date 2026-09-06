import { jobBoardPatchSchema, jobBoardSchema } from "@jobpilot/contracts/job-board";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { deletedResponseSchema } from "@/types/response";
import {
  jobBoardCatalogSchema,
  jobBoardListSchema,
  jobBoardRecordSchema,
} from "./job-board.schema";
import { JobBoardService } from "./job-board.service";

const svc = container.resolve(JobBoardService);

export const jobBoardController = new Elysia({
  prefix: "/job-boards",
  detail: { tags: ["Job Boards"] },
})
  .use(authGuard)
  .get("/", ({ user }) => svc.list(user.id), {
    response: jobBoardListSchema,
    detail: {
      summary: "List job boards",
      description:
        "Returns all saved job boards owned by the active profile, ordered by their sort order.",
    },
  })
  .get("/catalog", ({ user }) => svc.catalog(user.id), {
    response: jobBoardCatalogSchema,
    detail: {
      summary: "List available boards",
      description:
        "Returns the listed boards from the global catalog that the active profile has not linked yet.",
    },
  })
  .post("/", ({ user, body }) => svc.create(user.id, body), {
    body: jobBoardSchema,
    response: jobBoardRecordSchema,
    detail: {
      summary: "Create job board",
      description:
        "Creates a new job board for the active profile from the request body and returns the created record.",
    },
  })
  .patch("/:id", ({ user, params, body }) => svc.update(user.id, params.id, body), {
    params: idParam,
    body: jobBoardPatchSchema,
    response: jobBoardRecordSchema,
    detail: {
      summary: "Update job board",
      description:
        "Applies a partial update to the active profile's job board identified by id and returns the updated record.",
    },
  })
  .delete("/:id", ({ user, params }) => svc.remove(user.id, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete job board",
      description:
        "Deletes the active profile's job board identified by id and returns the id of the removed record.",
    },
  });
