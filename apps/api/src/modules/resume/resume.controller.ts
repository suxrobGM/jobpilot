import { idParam } from "@jobpilot/contracts/shared";
import { Elysia, sse } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { subscribe } from "@/common/sse";
import { resumeChannel } from "@/common/sse/channels/resume";
import { resumeFileController } from "./files/file.controller";
import { createResumeSchema, updateResumeSchema } from "./resume.schema";
import { ResumeService } from "./resume.service";
import { readUpload } from "./resume.upload";
import { resumeVariantController } from "./variants/variant.controller";

const svc = container.resolve(ResumeService);

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
    body: createResumeSchema,
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
    body: updateResumeSchema,
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
  // resume content-change SSE stream
  .get(
    "/:id/events",
    async ({ profileId, params }) => {
      await svc.assertResumeOwned(profileId, params.id);
      return sse(subscribe(resumeChannel, { resumeId: params.id }));
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
  // ── Sub-domain controllers (source files + master PDF, variants + tailoring) ───
  .use(resumeFileController)
  .use(resumeVariantController);
