import { resumeVariantCreateSchema, resumeVariantPatchSchema } from "@jobpilot/contracts/resume";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { tailorResumeSchema } from "../resume.schema";
import { ResumeVariantService } from "./variant.service";

const svc = container.resolve(ResumeVariantService);

export const resumeVariantController = new Elysia({
  name: "resume-variants",
  detail: { tags: ["Resumes"] },
})
  .use(profileGuard)
  // variant PDF (cached, binary)
  .get("/variants/:id/pdf", ({ profileId, params }) => svc.renderVariantPdf(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Render variant PDF",
      description:
        "Streams a tailored resume variant as a cached PDF, rendering it from the variant's structured content on first request.",
    },
  })
  // variants for a resume: list / create
  .get("/:id/variants", ({ profileId, params }) => svc.listVariants(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "List resume variants",
      description:
        "Returns all tailored variants belonging to the given master resume, ordered by most recently updated.",
    },
  })
  .post(
    "/:id/variants",
    ({ profileId, params, body }) => svc.createVariant(profileId, params.id, body),
    {
      params: idParam,
      body: resumeVariantCreateSchema,
      detail: {
        summary: "Create resume variant",
        description:
          "Creates a tailored variant under the given master resume from explicit structured content and returns the new variant's id.",
      },
    },
  )
  // deterministic tailored variant from model hints
  .post(
    "/:id/tailor",
    ({ profileId, params, body }) => svc.createTailoredVariant(profileId, params.id, body),
    {
      params: idParam,
      body: tailorResumeSchema,
      detail: {
        summary: "Create tailored variant",
        description:
          "Deterministically tailors the master resume from model-authored hints (summary, emphasized tech, validated bullet rewrites) and returns the new variant's id, PDF URL, reworded bullet count, and flags.",
      },
    },
  )
  // single variant CRUD
  .get("/variants/:id", ({ profileId, params }) => svc.getVariant(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Get resume variant",
      description:
        "Returns a single tailored variant owned by the active profile, including its parsed content, diff notes, and rewrite audit.",
    },
  })
  .patch(
    "/variants/:id",
    ({ profileId, params, body }) => svc.updateVariant(profileId, params.id, body),
    {
      params: idParam,
      body: resumeVariantPatchSchema,
      detail: {
        summary: "Update resume variant",
        description:
          "Partially updates a tailored variant's label, job URL, application link, content, or diff notes and returns the variant id.",
      },
    },
  )
  .delete("/variants/:id", ({ profileId, params }) => svc.removeVariant(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Delete resume variant",
      description:
        "Deletes a tailored variant owned by the active profile and returns the deleted variant id.",
    },
  });
