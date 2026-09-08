import { jobBoardSchema } from "@jobpilot/contracts/job-board";
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
        "Returns the active profile's boards: listed catalog boards in catalog order, then the profile's own additions. Logins are credentials scoped to the board's domain - see `GET /credentials/resolve`.",
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
        "Links the catalog board with the given domain to the active profile. An unknown domain is added to the catalog unlisted, using `name` and `searchUrl`. Linking a board twice returns 409.",
    },
  })
  .delete("/:id", ({ user, params }) => svc.remove(user.id, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Remove job board",
      description:
        "Unlinks the board from the active profile and returns the id of the removed link. The catalog row and any credential for the domain survive.",
    },
  });
