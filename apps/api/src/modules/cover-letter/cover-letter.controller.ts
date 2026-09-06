import { coverLetterCreateSchema } from "@jobpilot/contracts/cover-letter";
import { paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { okResponseSchema } from "@/types/response";
import {
  coverLetterCreatedSchema,
  coverLetterDetailSchema,
  coverLetterListSchema,
  pdfRequestSchema,
} from "./cover-letter.schema";
import { type CoverLetterPdf, CoverLetterService } from "./cover-letter.service";

const svc = container.resolve(CoverLetterService);

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
  .use(authGuard)
  .get("/", ({ user, query }) => svc.list(user.id, query), {
    query: paginationQuerySchema,
    response: coverLetterListSchema,
    detail: {
      summary: "List cover letters",
      description:
        "Returns one page of the active profile's saved cover letters, newest first, as `{ items, pagination }` - metadata only, without the letter body.",
    },
  })
  .post("/", ({ user, body }) => svc.create(user.id, body), {
    body: coverLetterCreateSchema,
    response: coverLetterCreatedSchema,
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
  .get("/:id", ({ user, params }) => svc.get(user.id, params.id), {
    params: idParam,
    response: coverLetterDetailSchema,
    detail: {
      summary: "Get cover letter",
      description:
        "Returns the full saved cover letter owned by the active profile, or a 404 if it does not exist.",
    },
  })
  .delete("/:id", ({ user, params }) => svc.remove(user.id, params.id), {
    params: idParam,
    response: okResponseSchema,
    detail: {
      summary: "Delete cover letter",
      description:
        "Deletes the active profile's saved cover letter and returns an ok acknowledgement, or a 404 if it does not exist.",
    },
  })
  .get(
    "/:id/pdf",
    async ({ user, params }) => pdfResponse(await svc.renderSavedPdf(user.id, params.id)),
    {
      params: idParam,
      detail: {
        summary: "Render saved cover-letter PDF",
        description:
          "Renders a saved cover letter to a PDF and returns it as an inline application/pdf Response for viewing in a new tab.",
      },
    },
  );
