import {
  resumeDataSchema,
  resumeVariantCreateSchema,
  resumeVariantPatchSchema,
} from "@jobpilot/contracts/resume";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { badRequest } from "@/common/errors";
import { profileGuard } from "@/common/middleware";
import { sseResponse, subscribe } from "@/common/sse";
import { resumeChannel } from "@/common/sse/channels/resume";
import { ResumeService } from "./resume.service";

const svc = container.resolve(ResumeService);

const jsonCreateSchema = z.object({
  label: z.string().min(1),
  content: resumeDataSchema.optional(),
});

const putSchema = z.object({
  label: z.string().min(1).optional(),
  content: resumeDataSchema.optional(),
});

const tailorRequestSchema = z.object({
  label: z.string().min(1),
  jobUrl: z.url().optional().nullable(),
  applicationId: z.number().int().positive().optional().nullable(),
  summary: z.string().optional(),
  emphasizedTech: z.array(z.string()).optional(),
  jobKeywords: z.array(z.string()).optional(),
  diffNotes: z.string().optional().nullable(),
  maxBulletsPerEntry: z.number().int().min(1).max(20).optional(),
  rewordTopN: z.number().int().min(0).max(3).optional(),
  bulletRewrites: z
    .array(
      z.object({
        entryIndex: z.number().int().min(0),
        bullets: z
          .array(z.object({ original: z.string().min(1), tailored: z.string().min(1) }))
          .min(1),
      }),
    )
    .optional(),
});

/** Pull a single `File` (and optional string field) out of a multipart request. */
async function readUpload(
  request: Request,
  field = "file",
  textField?: string,
): Promise<{ file: File; text?: string }> {
  const form = await request.formData();
  const file = form.get(field);
  if (!(file instanceof File)) {
    throw badRequest(`${field} field is required`);
  }
  const text = textField ? form.get(textField) : null;
  return { file, text: typeof text === "string" ? text : undefined };
}

export const resumeController = new Elysia({
  prefix: "/resumes",
  detail: { tags: ["Resumes"] },
})
  .use(profileGuard)
  // list
  .get("/", ({ profileId }) => svc.list(profileId), {
    detail: {
      summary: "List master resumes",
      description:
        "Returns all of the active profile's master resumes ordered by most recently updated, with variant counts and the primary resume listed first.",
    },
  })
  // create (structured JSON)
  .post("/", ({ profileId, body }) => svc.createJson(profileId, body), {
    body: jsonCreateSchema,
    detail: {
      summary: "Create resume from JSON",
      description:
        "Creates a new master resume from a structured JSON body and optional content, returning the new resume's id.",
    },
  })
  // create from uploaded source file (multipart)
  .post(
    "/upload",
    async ({ profileId, request }) => {
      const { file, text } = await readUpload(request, "file", "label");
      return svc.createFromUpload(profileId, file, text);
    },
    {
      detail: {
        summary: "Create resume from upload",
        description:
          "Creates a master resume from a multipart-uploaded source file (and optional label), storing the file on disk and returning the new resume's id.",
      },
    },
  )
  // single resume CRUD
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Get resume",
      description:
        "Returns a single master resume owned by the active profile, including its structured content, version, source-file metadata, and primary flag.",
    },
  })
  .put("/:id", ({ profileId, params, body }) => svc.update(profileId, params.id, body), {
    params: idParam,
    body: putSchema,
    detail: {
      summary: "Update resume",
      description:
        "Updates a master resume's label and/or structured content, bumping the version and writing a backup when content changes, and returns the id and new version.",
    },
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Delete resume",
      description:
        "Deletes a master resume along with its variants and all on-disk artifacts, clears the primary pointer if set, and returns the deleted id.",
    },
  })
  // master resume PDF (cached, binary)
  .get("/:id/pdf", ({ profileId, params }) => svc.renderPdf(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Render resume PDF",
      description:
        "Streams the master resume as a cached PDF, rendering from structured content when present or falling back to the uploaded source file.",
    },
  })
  // variant PDF (cached, binary)
  .get(
    "/variants/:id/pdf",
    ({ profileId, params }) => svc.renderVariantPdf(profileId, params.id),
    {
      params: idParam,
      detail: {
        summary: "Render variant PDF",
        description:
          "Streams a tailored resume variant as a cached PDF, rendering it from the variant's structured content on first request.",
      },
    },
  )
  // source file: stream / replace (multipart) / delete
  .get("/:id/source", ({ profileId, params }) => svc.getSource(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Stream resume source file",
      description:
        "Streams the resume's uploaded source file inline with its stored MIME type, or returns 404 when no source file exists.",
    },
  })
  .post(
    "/:id/source",
    async ({ profileId, params, request }) => {
      const { file } = await readUpload(request, "file");
      return svc.uploadSource(profileId, params.id, file);
    },
    {
      params: idParam,
      detail: {
        summary: "Replace resume source file",
        description:
          "Replaces the resume's source file with a multipart upload, deleting the previous file, and returns the id and new stored filename.",
      },
    },
  )
  .delete("/:id/source", ({ profileId, params }) => svc.deleteSource(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Delete resume source file",
      description:
        "Removes the resume's uploaded source file from disk, clears its source metadata, and returns the resume id.",
    },
  })
  // resume content-change SSE stream
  .get(
    "/:id/events",
    async ({ profileId, params }) => {
      await svc.assertResumeOwned(profileId, params.id);
      return sseResponse(subscribe(resumeChannel, { resumeId: params.id }));
    },
    {
      params: idParam,
      detail: {
        summary: "Stream resume change events",
        description:
          "Opens a Server-Sent Events stream that emits content-change events for the resume after verifying the active profile owns it.",
      },
    },
  )
  // variants for a resume: list / create
  .get(
    "/:id/variants",
    ({ profileId, params }) => svc.listVariants(profileId, params.id),
    {
      params: idParam,
      detail: {
        summary: "List resume variants",
        description:
          "Returns all tailored variants belonging to the given master resume, ordered by most recently updated.",
      },
    },
  )
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
      body: tailorRequestSchema,
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
  .delete(
    "/variants/:id",
    ({ profileId, params }) => svc.removeVariant(profileId, params.id),
    {
      params: idParam,
      detail: {
        summary: "Delete resume variant",
        description:
          "Deletes a tailored variant owned by the active profile and returns the deleted variant id.",
      },
    },
  );
