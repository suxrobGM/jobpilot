import {
  adminJobListingPatchSchema,
  adminJobListingQuerySchema,
} from "@jobpilot/contracts/job-listing";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { requireRole } from "@/common/middleware";
import { deletedResponseSchema } from "@/types/response";
import { adminJobListingPageSchema, adminJobListingSchema } from "./job-listing.schema";
import { JobListingService } from "./job-listing.service";

const svc = container.resolve(JobListingService);

/** Moderation for the public job index. Register new admin controllers in `admin.guard.test.ts`. */
export const adminJobListingController = new Elysia({
  prefix: "/admin/listings",
  detail: { tags: ["Admin"] },
})
  .use(requireRole("ADMIN"))
  .get("/", ({ query }) => svc.listForAdmin(query), {
    query: adminJobListingQuerySchema,
    response: adminJobListingPageSchema,
    detail: {
      summary: "List job listings",
      description:
        "Returns a page of public job listings, including hidden ones. The moderation view of the deduped job index.",
    },
  })
  .patch("/:id", ({ params, body }) => svc.setStatus(params.id, body.status), {
    params: idParam,
    body: adminJobListingPatchSchema,
    response: adminJobListingSchema,
    detail: {
      summary: "Publish or hide a job listing",
      description:
        "Sets a listing's moderation status. A hidden listing disappears from the public /jobs pages but is kept, so a re-scrape does not resurrect it as published.",
    },
  })
  .delete("/:id", ({ params }) => svc.remove(params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete a job listing",
      description:
        "Removes a listing and its source rows. A later scrape of the same posting will recreate it - prefer hiding.",
    },
  });
