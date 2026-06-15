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
import { ResumesService } from "./resumes.service";

const svc = container.resolve(ResumesService);

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

export const resumesController = new Elysia({
  prefix: "/resumes",
  detail: { tags: ["Resumes"] },
})
  .use(profileGuard)
  // list
  .get("/", ({ profileId }) => svc.list(profileId))
  // create (structured JSON)
  .post("/", ({ profileId, body }) => svc.createJson(profileId, body), {
    body: jsonCreateSchema,
  })
  // create from uploaded source file (multipart)
  .post("/upload", async ({ profileId, request }) => {
    const { file, text } = await readUpload(request, "file", "label");
    return svc.createFromUpload(profileId, file, text);
  })
  // single resume CRUD
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), { params: idParam })
  .put("/:id", ({ profileId, params, body }) => svc.update(profileId, params.id, body), {
    params: idParam,
    body: putSchema,
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
  })
  // master resume PDF (cached, binary)
  .get("/:id/pdf", ({ profileId, params }) => svc.renderPdf(profileId, params.id), {
    params: idParam,
  })
  // variant PDF (cached, binary)
  .get(
    "/variants/:id/pdf",
    ({ profileId, params }) => svc.renderVariantPdf(profileId, params.id),
    { params: idParam },
  )
  // source file: stream / replace (multipart) / delete
  .get("/:id/source", ({ profileId, params }) => svc.getSource(profileId, params.id), {
    params: idParam,
  })
  .post(
    "/:id/source",
    async ({ profileId, params, request }) => {
      const { file } = await readUpload(request, "file");
      return svc.uploadSource(profileId, params.id, file);
    },
    { params: idParam },
  )
  .delete("/:id/source", ({ profileId, params }) => svc.deleteSource(profileId, params.id), {
    params: idParam,
  })
  // resume content-change SSE stream
  .get(
    "/:id/events",
    async ({ profileId, params }) => {
      await svc.assertResumeOwned(profileId, params.id);
      return sseResponse(subscribe(resumeChannel, { resumeId: params.id }));
    },
    { params: idParam },
  )
  // variants for a resume: list / create
  .get(
    "/:id/variants",
    ({ profileId, params }) => svc.listVariants(profileId, params.id),
    { params: idParam },
  )
  .post(
    "/:id/variants",
    ({ profileId, params, body }) => svc.createVariant(profileId, params.id, body),
    { params: idParam, body: resumeVariantCreateSchema },
  )
  // deterministic tailored variant from model hints
  .post(
    "/:id/tailor",
    ({ profileId, params, body }) => svc.createTailoredVariant(profileId, params.id, body),
    { params: idParam, body: tailorRequestSchema },
  )
  // single variant CRUD
  .get("/variants/:id", ({ profileId, params }) => svc.getVariant(profileId, params.id), {
    params: idParam,
  })
  .patch(
    "/variants/:id",
    ({ profileId, params, body }) => svc.updateVariant(profileId, params.id, body),
    { params: idParam, body: resumeVariantPatchSchema },
  )
  .delete(
    "/variants/:id",
    ({ profileId, params }) => svc.removeVariant(profileId, params.id),
    { params: idParam },
  );
