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
        "Returns the active profile's boards: listed catalog boards in catalog order, then the profile's own additions. Passwords are never returned; `hasPassword` says whether one is stored.",
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
      summary: "Add job board",
      description:
        "Links the catalog board with the given domain to the active profile and stores the optional login. An unknown domain is added to the catalog unlisted, using `name` and `searchUrl`. Linking a board twice returns 409.",
    },
  })
  .patch("/:id", ({ user, params, body }) => svc.update(user.id, params.id, body), {
    params: idParam,
    body: jobBoardPatchSchema,
    response: jobBoardRecordSchema,
    detail: {
      summary: "Update board login",
      description:
        "Sets the profile's email and/or password for the board. Omit a field to keep it, send null to clear it. Name and search URL belong to the catalog and are admin-managed.",
    },
  })
  .delete("/:id", ({ user, params }) => svc.remove(user.id, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Remove job board",
      description:
        "Unlinks the board from the active profile and returns the id of the removed link. The catalog row survives.",
    },
  });
