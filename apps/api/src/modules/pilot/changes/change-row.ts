import { type PilotChange, pilotChangeActionSchema } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { DAY_MS } from "@/common/date/buckets";
import type { PilotChange as PilotChangeModel } from "@/generated/prisma/client";

const UNDO_WINDOW_MS = 7 * DAY_MS;

export const storedActionsSchema = z.array(pilotChangeActionSchema);

export function canUndo(row: PilotChangeModel, now: number): boolean {
  const decided = row.decidedAt?.getTime() ?? 0;
  return row.status === "applied" && row.undo !== null && now - decided < UNDO_WINDOW_MS;
}

export function toPilotChange(row: PilotChangeModel, now = Date.now()): PilotChange {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    summary: row.summary,
    actions: storedActionsSchema.parse(row.actions),
    canUndo: canUndo(row, now),
    runId: row.runId,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  };
}
