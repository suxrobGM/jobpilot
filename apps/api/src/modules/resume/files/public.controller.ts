import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { ResumeFileService } from "./file.service";

const svc = container.resolve(ResumeFileService);

const limitPublicPdf = rateLimit(RATE_LIMITS.publicResumePdf);

/**
 * Unauthenticated resume PDF access - the resume's v4 uuid is the capability
 * token. Used for recipient-reachable links (e.g. networking emails) where a
 * bearer-authed `/api/resumes/:id/pdf` would not be openable.
 */
export const publicResumeController = new Elysia({
  prefix: "/public/resumes",
  detail: { tags: ["Resumes"] },
}).get("/:id/pdf", ({ params }) => svc.renderPublicPdf(params.id), {
  params: idParam,
  beforeHandle: limitPublicPdf,
  detail: {
    summary: "Render resume PDF (public)",
    description:
      "Streams a resume as a PDF without authentication, keyed by the resume's unguessable uuid, for recipient-reachable links such as networking emails.",
  },
});
