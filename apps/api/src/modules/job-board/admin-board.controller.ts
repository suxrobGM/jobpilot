import { adminBoardPatchSchema, adminBoardSchema } from "@jobpilot/contracts/job-board";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { requireRole } from "@/common/middleware";
import { deletedResponseSchema } from "@/types/response";
import { AdminBoardService } from "./admin-board.service";
import {
  adminBoardListQuery,
  adminBoardListSchema,
  adminBoardRecordSchema,
} from "./job-board.schema";

const svc = container.resolve(AdminBoardService);

/** Catalog CRUD for admins. Register new admin controllers in `admin.guard.test.ts`. */
export const adminBoardController = new Elysia({
  prefix: "/admin/boards",
  detail: { tags: ["Admin"] },
})
  .use(requireRole("ADMIN"))
  .get("/", ({ query }) => svc.list(query), {
    query: adminBoardListQuery,
    response: adminBoardListSchema,
    detail: {
      summary: "List catalog boards",
      description:
        "Returns one page of the global board catalog as `{ items, pagination }`, listed boards first, each with the number of profiles that linked it, optionally filtered by a name/domain search term.",
    },
  })
  .post("/", ({ body }) => svc.create(body), {
    body: adminBoardSchema,
    response: adminBoardRecordSchema,
    detail: {
      summary: "Create catalog board",
      description:
        "Adds a board to the global catalog and returns the created record. The domain must be unique.",
    },
  })
  .patch("/:id", ({ params, body }) => svc.update(params.id, body), {
    params: idParam,
    body: adminBoardPatchSchema,
    response: adminBoardRecordSchema,
    detail: {
      summary: "Update catalog board",
      description:
        "Applies a partial update to a catalog board identified by id and returns the updated record.",
    },
  })
  .delete("/:id", ({ params }) => svc.remove(params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete catalog board",
      description:
        "Removes a board from the global catalog. This also unlinks it from every profile that had adopted it.",
    },
  });
