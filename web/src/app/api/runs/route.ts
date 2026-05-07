import type { Prisma } from "@/generated/prisma/client";
import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { createRunSchema } from "@/lib/schemas/run";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const source = url.searchParams.get("source");
  const where: Prisma.RunWhereInput = {};
  if (status) where.status = status;
  if (source) where.source = source;
  const runs = await db.run.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: 200,
  });
  return ok(
    runs.map((r) => ({
      ...r,
      config: JSON.parse(r.config) as Record<string, unknown>,
      summary: JSON.parse(r.summary) as Record<string, unknown>,
    })),
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createRunSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      ErrorCodes.UNPROCESSABLE,
      "Invalid run payload",
      422,
      parsed.error.issues,
    );
  }
  const data = parsed.data;
  try {
    const run = await db.run.create({
      data: {
        runId: data.runId,
        query: data.query,
        source: data.source,
        config: JSON.stringify(data.config ?? {}),
      },
    });
    return ok(run, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return err(ErrorCodes.CONFLICT, "Run with this id already exists", 409);
    }
    throw e;
  }
}
