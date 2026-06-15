import { coverLetterCreateSchema } from "@jobpilot/contracts/cover-letter";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { type CoverLetterPdf, CoverLetterService } from "./cover-letter.service";

const svc = container.resolve(CoverLetterService);

const pdfRequestSchema = z.object({
  text: z.string().min(1),
  name: z.string().optional(),
});

/** Wrap a rendered cover-letter PDF in an inline Response. */
function pdfResponse({ buffer, slug }: CoverLetterPdf): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(buffer.length),
      "content-disposition": `inline; filename="${slug}.pdf"`,
    },
  });
}

export const coverLetterController = new Elysia({
  prefix: "/cover-letters",
  detail: { tags: ["CoverLetters"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => svc.list(profileId), {
    detail: {
      summary: "List cover letters",
      description:
        "Returns the active profile's saved cover letters, newest first, as a metadata list without the letter body.",
    },
  })
  .post("/", ({ profileId, body }) => svc.create(profileId, body), {
    body: coverLetterCreateSchema,
    detail: {
      summary: "Create cover letter",
      description:
        "Saves a new cover letter for the active profile and returns the created record.",
    },
  })
  .post(
    "/pdf",
    async ({ body }) => pdfResponse(await svc.renderEphemeralPdf(body.text, body.name)),
    {
      body: pdfRequestSchema,
      detail: {
        summary: "Render ephemeral cover-letter PDF",
        description:
          "Renders the supplied cover-letter text to a PDF and returns it as an inline application/pdf Response without persisting anything.",
      },
    },
  )
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Get cover letter",
      description:
        "Returns the full saved cover letter owned by the active profile, or a 404 if it does not exist.",
    },
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Delete cover letter",
      description:
        "Deletes the active profile's saved cover letter and returns an ok acknowledgement, or a 404 if it does not exist.",
    },
  })
  .get(
    "/:id/pdf",
    async ({ profileId, params }) => pdfResponse(await svc.renderSavedPdf(profileId, params.id)),
    {
      params: idParam,
      detail: {
        summary: "Render saved cover-letter PDF",
        description:
          "Renders a saved cover letter to a PDF and returns it as an inline application/pdf Response for viewing in a new tab.",
      },
    },
  );
