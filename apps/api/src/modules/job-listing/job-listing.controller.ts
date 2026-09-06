import { jobListingQuerySchema } from "@jobpilot/contracts/job-listing";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di/container";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import {
  jobListingFacetsSchema,
  jobListingPageSchema,
  jobListingSchema,
  jobListingSitemapSchema,
} from "./job-listing.schema";
import { JobListingService } from "./job-listing.service";

const svc = container.resolve(JobListingService);

/** Deliberately unguarded (auth is opt-in here): this backs the crawlable public /jobs pages. */
export const publicJobListingController = new Elysia({
  prefix: "/public/jobs",
  detail: { tags: ["Jobs"] },
})
  // Scoped once, so a route added later cannot forget it.
  .guard({ beforeHandle: rateLimit(RATE_LIMITS.publicJobs) })
  .get("/", ({ query }) => svc.list(query), {
    query: jobListingQuerySchema,
    response: jobListingPageSchema,
    detail: {
      summary: "List public job listings",
      description:
        "Returns a page of deduped, published job listings filtered by free text, location, remote, board, and skills. Unauthenticated.",
    },
  })
  // Declared before /:slug so the literal path wins the match.
  .get("/facets", () => svc.facets(), {
    response: jobListingFacetsSchema,
    detail: {
      summary: "Job listing filter facets",
      description:
        "Returns the skills present in the published index with their listing counts, most common first. Backs the /jobs `?tech=` filter. Unauthenticated.",
    },
  })
  .get("/sitemap", () => svc.sitemap(), {
    response: jobListingSitemapSchema,
    detail: {
      summary: "Job listing sitemap feed",
      description:
        "Returns the slug and last-seen date of every published listing, capped at 5000, for the web app's sitemap.xml.",
    },
  })
  .get("/:slug", ({ params }) => svc.bySlug(params.slug), {
    params: z.object({ slug: z.string().min(1) }),
    response: jobListingSchema,
    detail: {
      summary: "Get a public job listing",
      description:
        "Returns one published listing by slug, including every board it was seen on. Unauthenticated.",
    },
  });
