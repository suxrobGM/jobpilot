import { idParam } from "@jobpilot/contracts/shared";
import { resumeChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { sseStream } from "@/common/sse";
import { deletedResponseSchema, idResponseSchema } from "@/types/response";
import {
  createResumeSchema,
  resumeDetailSchema,
  resumeListSchema,
  resumeUpdatedSchema,
  resumeUploadSchema,
  sourceUploadedSchema,
  sourceUploadSchema,
  updateResumeSchema,
} from "./resume.schema";
import { ResumeService } from "./resume.service";

const svc = container.get(ResumeService);

export const resumeController = new Elysia({
  prefix: "/resumes",
  detail: { tags: ["Resumes"] },
})
  .use(authGuard)
  .get("/", ({ user }) => svc.list(user.id), {
    response: resumeListSchema,
    detail: {
      summary: "List master resumes",
      description:
        "Returns all of the user's master resumes ordered by most recently updated, with variant counts and the primary resume listed first.",
    },
  })
  .post("/", ({ user, body }) => svc.createJson(user.id, body), {
    body: createResumeSchema,
    response: idResponseSchema,
    detail: {
      summary: "Create resume from JSON",
      description:
        "Creates a new master resume from a structured JSON body and optional content, returning the new resume's id.",
    },
  })
  .post("/upload", ({ user, body }) => svc.createFromUpload(user.id, body.file, body.label), {
    body: resumeUploadSchema,
    response: idResponseSchema,
    detail: {
      summary: "Create resume from upload",
      description:
        "Creates a master resume from a multipart-uploaded source file (and optional label), storing the file on disk and returning the new resume's id.",
    },
  })
  .get("/:id", ({ user, params }) => svc.get(user.id, params.id), {
    params: idParam,
    response: resumeDetailSchema,
    detail: {
      summary: "Get resume",
      description:
        "Returns a single master resume owned by the user, including its structured content, version, source-file metadata, and primary flag.",
    },
  })
  .put("/:id", ({ user, params, body }) => svc.update(user.id, params.id, body), {
    params: idParam,
    body: updateResumeSchema,
    response: resumeUpdatedSchema,
    detail: {
      summary: "Update resume",
      description:
        "Updates a master resume's label and/or structured content, bumping the version when content changes, and returns the id and new version.",
    },
  })
  .delete("/:id", ({ user, params }) => svc.remove(user.id, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete resume",
      description:
        "Deletes a master resume along with its variants and all on-disk artifacts, clears the primary pointer if set, and returns the deleted id.",
    },
  })
  .get(
    "/:id/events",
    async ({ user, params, headers }) => {
      await svc.findOwned(user.id, params.id);
      return sseStream(resumeChannel, { resumeId: params.id }, headers);
    },
    {
      params: idParam,
      detail: {
        summary: "Stream resume change events",
        description:
          "Opens a Server-Sent Events stream that emits content-change events for the resume after verifying the user owns it.",
      },
    },
  )
  .get("/:id/pdf", ({ user, params }) => svc.renderPdf(user.id, params.id), {
    params: idParam,
    detail: {
      summary: "Render resume PDF",
      description:
        "Streams the master resume as a cached PDF, rendered from structured content when present, else the uploaded source file.",
    },
  })
  .get("/:id/source", ({ user, params }) => svc.getSource(user.id, params.id), {
    params: idParam,
    detail: {
      summary: "Stream resume source file",
      description: "Streams the resume's uploaded source file, or 404 when there is none.",
    },
  })
  .post(
    "/:id/source",
    ({ user, params, body }) => svc.uploadSource(user.id, params.id, body.file),
    {
      params: idParam,
      body: sourceUploadSchema,
      response: sourceUploadedSchema,
      detail: {
        summary: "Replace resume source file",
        description:
          "Replaces the resume's source file with a multipart upload and returns the new stored filename.",
      },
    },
  )
  .delete("/:id/source", ({ user, params }) => svc.deleteSource(user.id, params.id), {
    params: idParam,
    response: idResponseSchema,
    detail: {
      summary: "Delete resume source file",
      description: "Removes the resume's uploaded source file and clears its source metadata.",
    },
  });

/** Unauthenticated, for recipient-reachable links such as networking emails. */
export const publicResumeController = new Elysia({
  prefix: "/public/resumes",
  detail: { tags: ["Resumes"] },
}).get("/:id/pdf", ({ params }) => svc.renderPublicPdf(params.id), {
  params: idParam,
  beforeHandle: rateLimit(RATE_LIMITS.publicResumePdf),
  detail: {
    summary: "Render resume PDF (public)",
    description:
      "Streams a resume as a PDF without authentication, keyed by the resume's unguessable uuid.",
  },
});
