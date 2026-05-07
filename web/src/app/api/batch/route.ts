import type { Prisma } from "@/generated/prisma/client";
import { err, ErrorCodes, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { addBatchSchema } from "@/lib/schemas/batch";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where: Prisma.BatchInputWhereInput = {};
  if (status) {
    where.status = status;
  }
  const items = await db.batchInput.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
  return ok(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = addBatchSchema.safeParse(body);

  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid batch payload", 422, parsed.error.issues);
  }

  const created = await db.$transaction(
    parsed.data.urls.map((u) =>
      db.batchInput.upsert({
        where: { url: u },
        create: { url: u, note: parsed.data.note ?? null, status: "pending" },
        update: { note: parsed.data.note ?? null, status: "pending" },
      }),
    ),
  );
  return ok({ inserted: created.length, items: created }, { status: 201 });
}
