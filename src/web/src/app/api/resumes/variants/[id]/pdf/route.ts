import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { err, ErrorCodes } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { renderResumePdf } from "@/lib/pdf/render";
import type { ResumeData } from "@/lib/schemas/resume";
import { ensureGeneratedDir, generatedVariantPath, slugifyForDownload } from "@/lib/storage";

const PROFILE_ID = 1;

type Params = ApiRouteContext<{ id: string }>;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const variant = await db.resumeVariant.findFirst({
    where: { id, resume: { profileId: PROFILE_ID } },
  });
  if (!variant) {
    return err(ErrorCodes.NOT_FOUND, "Variant not found", 404);
  }

  await ensureGeneratedDir();
  const cachePath = generatedVariantPath(variant.id, variant.updatedAt.getTime());
  try {
    await stat(cachePath);
  } catch {
    const buffer = await renderResumePdf(JSON.parse(variant.data) as ResumeData);
    await writeFile(cachePath, buffer);
  }

  const stats = await stat(cachePath);
  const stream = createReadStream(cachePath);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(stats.size),
      "content-disposition": `inline; filename="${slugifyForDownload(variant.label)}.pdf"`,
    },
  });
}
