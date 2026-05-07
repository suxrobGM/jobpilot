import { ok } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  const boards = await db.jobBoard.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return ok(boards);
}
