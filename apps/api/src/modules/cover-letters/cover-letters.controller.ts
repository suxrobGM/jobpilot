import { coverLetterCreateSchema } from "@jobpilot/contracts/cover-letter";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { type CoverLetterPdf, CoverLettersService } from "./cover-letters.service";

const svc = container.resolve(CoverLettersService);

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

export const coverLettersController = new Elysia({
  prefix: "/cover-letters",
  detail: { tags: ["CoverLetters"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => svc.list(profileId))
  .post("/", ({ profileId, body }) => svc.create(profileId, body), {
    body: coverLetterCreateSchema,
  })
  .post(
    "/pdf",
    async ({ body }) => pdfResponse(await svc.renderEphemeralPdf(body.text, body.name)),
    { body: pdfRequestSchema },
  )
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), { params: idParam })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), { params: idParam })
  .get(
    "/:id/pdf",
    async ({ profileId, params }) => pdfResponse(await svc.renderSavedPdf(profileId, params.id)),
    { params: idParam },
  );
