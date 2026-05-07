import { ok } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  const items = await db.batchInput.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  return ok(items);
}
