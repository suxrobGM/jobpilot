import { resumeVariantCreateSchema, resumeVariantPatchSchema } from "@jobpilot/contracts/resume";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import { deletedResponseSchema, idResponseSchema } from "@/types/response";
import { tailorResumeSchema } from "../resume.schema";
import { tailoredVariantSchema, variantDetailSchema, variantListSchema } from "./variant.schema";
import { ResumeVariantService } from "./variant.service";

const svc = container.resolve(ResumeVariantService);

export const resumeVariantController = new Elysia({
  name: "resume-variants",
  prefix: "/resumes",
  detail: { tags: ["Resumes"] },
})
  .use(authGuard)
  // variant PDF (cached, binary)
  .get("/variants/:id/pdf", ({ user, params }) => svc.renderVariantPdf(user.id, params.id), {
    params: idParam,
    detail: {
      summary: "Render variant PDF",
      description:
        "Streams a tailored resume variant as a cached PDF, rendering it from the variant's structured content on first request.",
    },
  })
  // variants for a resume: list / create
  .get("/:id/variants", ({ user, params }) => svc.listVariants(user.id, params.id), {
    params: idParam,
    response: variantListSchema,
    detail: {
      summary: "List resume variants",
      description:
        "Returns all tailored variants belonging to the given master resume, ordered by most recently updated.",
    },
  })
  .post("/:id/variants", ({ user, params, body }) => svc.createVariant(user.id, params.id, body), {
    params: idParam,
    body: resumeVariantCreateSchema,
    response: idResponseSchema,
    detail: {
      summary: "Create resume variant",
      description:
        "Creates a tailored variant under the given master resume from explicit structured content and returns the new variant's id.",
    },
  })
  // deterministic tailored variant from model hints
  .post(
    "/:id/tailor",
    ({ user, params, body }) => svc.createTailoredVariant(user.id, params.id, body),
    {
      params: idParam,
      body: tailorResumeSchema,
      response: tailoredVariantSchema,
      detail: {
        summary: "Create tailored variant",
        description:
          "Deterministically tailors the master resume from model-authored hints (summary, emphasized tech, validated bullet rewrites) and returns the new variant's id, PDF URL, reworded bullet count, and flags.",
      },
    },
  )
  // single variant CRUD
  .get("/variants/:id", ({ user, params }) => svc.getVariant(user.id, params.id), {
    params: idParam,
    response: variantDetailSchema,
    detail: {
      summary: "Get resume variant",
      description:
        "Returns a single tailored variant owned by the active profile, including its parsed content, diff notes, and rewrite audit.",
    },
  })
  .patch("/variants/:id", ({ user, params, body }) => svc.updateVariant(user.id, params.id, body), {
    params: idParam,
    body: resumeVariantPatchSchema,
    response: idResponseSchema,
    detail: {
      summary: "Update resume variant",
      description:
        "Partially updates a tailored variant's label, job URL, application link, content, or diff notes and returns the variant id.",
    },
  })
  .delete("/variants/:id", ({ user, params }) => svc.removeVariant(user.id, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete resume variant",
      description:
        "Deletes a tailored variant owned by the active profile and returns the deleted variant id.",
    },
  });
