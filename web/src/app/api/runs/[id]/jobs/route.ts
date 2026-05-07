import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { addRunJobSchema } from "@/lib/schemas/run";
import { publishRunEvent } from "@/lib/sse";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const jobs = await db.runJob.findMany({
    where: { runId: id },
    orderBy: { id: "asc" },
  });
  return ok(jobs);
}

export async function POST(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = addRunJobSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      ErrorCodes.UNPROCESSABLE,
      "Invalid run job payload",
      422,
      parsed.error.issues,
    );
  }
  const existing = await db.run.findUnique({ where: { runId: id } });
  if (!existing) return err(ErrorCodes.NOT_FOUND, "Run not found", 404);

  try {
    const job = await db.runJob.create({
      data: {
        runId: id,
        jobKey: parsed.data.jobKey,
        title: parsed.data.title,
        company: parsed.data.company,
        location: parsed.data.location ?? null,
        salary: parsed.data.salary ?? null,
        type: parsed.data.type ?? null,
        url: parsed.data.url,
        board: parsed.data.board ?? null,
        matchScore: parsed.data.matchScore ?? null,
        matchReason: parsed.data.matchReason ?? null,
        status: parsed.data.status ?? "pending",
        description: parsed.data.description ?? null,
      },
    });
    publishRunEvent(id, { type: "job-update", payload: { kind: "added", job } });
    return ok(job, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return err(ErrorCodes.CONFLICT, "Job with this jobKey already exists in run", 409);
    }
    throw e;
  }
}
