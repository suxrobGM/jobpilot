import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { readUpload } from "../resume.upload";
import { ResumeFileService } from "./file.service";

const svc = container.resolve(ResumeFileService);

export const resumeFileController = new Elysia({
  name: "resume-files",
  detail: { tags: ["Resumes"] },
})
  .use(profileGuard)
  // master resume PDF (cached, binary)
  .get("/:id/pdf", ({ profileId, params }) => svc.renderPdf(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Render resume PDF",
      description:
        "Streams the master resume as a cached PDF, rendering from structured content when present or falling back to the uploaded source file.",
    },
  })
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
  });
