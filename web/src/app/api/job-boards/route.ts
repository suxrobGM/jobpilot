import { err, ErrorCodes, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { jobBoardSchema } from "@/lib/schemas/job-board";

export async function GET() {
  const boards = await db.jobBoard.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return ok(boards);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = jobBoardSchema.safeParse(body);

  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid board payload", 422, parsed.error.issues);
  }

  try {
    const board = await db.jobBoard.create({ data: parsed.data });
    return ok(board, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return err(ErrorCodes.CONFLICT, "Board with this domain already exists", 409);
    }
    throw e;
  }
}
