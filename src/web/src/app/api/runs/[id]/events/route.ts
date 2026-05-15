import { err, ErrorCodes, ok } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { runEventSchema } from "@/lib/schemas/run";
import { publishRunEvent, subscribeToRun } from "@/lib/sse";

type Params = ApiRouteContext<{ id: string }>;

export async function GET(_req: Request, ctx: Params) {
  const { id } = await parsePathParams(ctx);
  const run = await db.run.findUnique({ where: { runId: id }, select: { runId: true } });

  if (!run) {
    return err(ErrorCodes.NOT_FOUND, "Run not found", 404);
  }

  const stream = subscribeToRun(id);
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export async function POST(req: Request, ctx: Params) {
  const { id } = await parsePathParams(ctx);
  const body = await req.json();
  const parsed = runEventSchema.safeParse(body);

  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid event payload", 422, parsed.error.issues);
  }

  const event = await db.runEvent.create({
    data: {
      runId: id,
      type: parsed.data.type,
      payload: JSON.stringify(parsed.data.payload),
    },
  });

  publishRunEvent(id, {
    type: parsed.data.type,
    payload: parsed.data.payload,
  });

  return ok({ id: event.id }, { status: 201 });
}
