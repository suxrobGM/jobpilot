import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { readUpload } from "../resume.upload";
import { sourceDeletedSchema, sourceUploadedSchema } from "./file.schema";
import { ResumeFileService } from "./file.service";

const svc = container.resolve(ResumeFileService);

export const resumeFileController = new Elysia({
  name: "resume-files",
  prefix: "/resumes",
  detail: { tags: ["Resumes"] },
})
  .use(authGuard)
  // master resume PDF (cached, binary)
  .get("/:id/pdf", ({ user, params }) => svc.renderPdf(user.id, params.id), {
    params: idParam,
    detail: {
      summary: "Render resume PDF",
      description:
        "Streams the master resume as a cached PDF, rendering from structured content when present or falling back to the uploaded source file.",
    },
  })
  // source file: stream / replace (multipart) / delete
  .get("/:id/source", ({ user, params }) => svc.getSource(user.id, params.id), {
    params: idParam,
    detail: {
      summary: "Stream resume source file",
      description:
        "Streams the resume's uploaded source file inline with its stored MIME type, or returns 404 when no source file exists.",
    },
  })
  .post(
    "/:id/source",
    async ({ user, params, request }) => {
      const { file } = await readUpload(request, "file");
      return svc.uploadSource(user.id, params.id, file);
    },
    {
      params: idParam,
      response: sourceUploadedSchema,
      detail: {
        summary: "Replace resume source file",
        description:
          "Replaces the resume's source file with a multipart upload, deleting the previous file, and returns the id and new stored filename.",
      },
    },
  )
  .delete("/:id/source", ({ user, params }) => svc.deleteSource(user.id, params.id), {
    params: idParam,
    response: sourceDeletedSchema,
    detail: {
      summary: "Delete resume source file",
      description:
        "Removes the resume's uploaded source file from disk, clears its source metadata, and returns the resume id.",
    },
  });
