import { jobListingQuerySchema } from "@jobpilot/contracts/job-listing";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di/container";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import {
  jobListingFacetsSchema,
  jobListingPageSchema,
  jobListingSchema,
  jobListingSitemapSchema,
  similarJobListingsSchema,
} from "./job-listing.schema";
import { JobListingService } from "./job-listing.service";

const listings = container.get(JobListingService);

/** Deliberately unguarded (auth is opt-in here): this backs the crawlable public /jobs pages. */
export const publicJobListingController = new Elysia({
  prefix: "/public/jobs",
  detail: { tags: ["Jobs"] },
})
  // Scoped once, so a route added later cannot forget it.
  .guard({ beforeHandle: rateLimit(RATE_LIMITS.publicJobs) })
  .get("/", ({ query }) => listings.list(query), {
    query: jobListingQuerySchema,
    response: jobListingPageSchema,
    detail: {
      summary: "List public job listings",
      description:
        "Returns a page of deduped, published job listings filtered by free text, location, remote, board, skills, and first-seen window, sorted by last or first sighting. Unauthenticated.",
    },
  })
  // Declared before /:slug so the literal path wins the match.
  .get("/facets", () => listings.facets(), {
    response: jobListingFacetsSchema,
    detail: {
      summary: "Job listing filter facets",
      description:
        "Returns the skills present in the published index with their listing counts, most common first. Backs the /jobs `?tech=` filter. Unauthenticated.",
    },
  })
  .get("/sitemap", () => listings.sitemap(), {
    response: jobListingSitemapSchema,
    detail: {
      summary: "Job listing sitemap feed",
      description:
        "Returns the slug and last-seen date of every published listing, capped under the sitemap URL limit, for the web app's sitemap.xml.",
    },
  })
  .get("/:slug/exists", ({ params }) => listings.assertPublished(params.slug), {
    params: z.object({ slug: z.string().min(1) }),
    response: okResponseSchema,
    detail: {
      summary: "Check a public job listing exists",
      description:
        "Ok when the slug is a published listing, 404 otherwise. Lets the web send a real 404 without fetching the detail. Unauthenticated.",
    },
  })
  .get("/:slug/similar", ({ params }) => listings.similar(params.slug), {
    params: z.object({ slug: z.string().min(1) }),
    response: similarJobListingsSchema,
    detail: {
      summary: "List similar public job listings",
      description:
        "Returns up to six other published listings that share a skill with this one, ranked by shared skills, then shared title words, matching remote flag and region, then newest. 404 when the slug is not a published listing. Unauthenticated.",
    },
  })
  .get("/:slug", ({ params }) => listings.getBySlug(params.slug), {
    params: z.object({ slug: z.string().min(1) }),
    response: jobListingSchema,
    detail: {
      summary: "Get a public job listing",
      description:
        "Returns one published listing by slug, including every board it was seen on. Unauthenticated.",
    },
  });
