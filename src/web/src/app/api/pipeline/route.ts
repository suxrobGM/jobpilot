import { err, ErrorCodes, ok } from "@/lib/api";
import {
  emptyPage,
  loadApplying,
  loadQueued,
  loadReplied,
  loadSubmitted,
} from "./_lib/loaders";
import { parsePipelineQuery } from "./_lib/params";

export async function GET(req: Request) {
  const query = parsePipelineQuery(req);
  if (!query) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid or missing 'stage' parameter", 400);
  }

  const { stage, cursor, limit, filters } = query;

  switch (stage) {
    case "discovered":
      return ok(emptyPage("discovered"));
    case "queued":
      return ok(await loadQueued(cursor, limit, filters));
    case "applying":
      return ok(await loadApplying(cursor, limit, filters));
    case "submitted":
      return ok(await loadSubmitted(cursor, limit, filters));
    case "replied":
      return ok(await loadReplied(cursor, limit, filters));
  }
}
