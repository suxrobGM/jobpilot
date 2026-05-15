import type { Prisma } from "@/generated/prisma/client";
import { err, ErrorCodes, ok } from "@/lib/api";
import { parseQueryParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { addQueueSchema } from "@/lib/schemas/queue";

export async function GET(req: Request) {
  const { status } = parseQueryParams(req, ["status"] as const);
  const where: Prisma.QueueEntryWhereInput = {};
  if (status) {
    where.status = status;
  }
  const items = await db.queueEntry.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
  return ok(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = addQueueSchema.safeParse(body);

  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid queue payload", 422, parsed.error.issues);
  }

  const created = await db.$transaction(
    parsed.data.urls.map((u) =>
      db.queueEntry.upsert({
        where: { url: u },
        create: { url: u, note: parsed.data.note ?? null, status: "pending" },
        update: { note: parsed.data.note ?? null, status: "pending" },
      }),
    ),
  );
  return ok({ inserted: created.length, items: created }, { status: 201 });
}
