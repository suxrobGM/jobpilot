import { pilotJournalEntrySchema } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";

/** Rows created by a batch journal append. */
export const createPilotJournalResponseSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
});

/** Orchestrator liveness probe: newest server-side agent activity + the active-claim count. */
export const pilotActivityResponseSchema = z.object({
  lastActivityAt: z.date().nullable(),
  activeClaims: z.number().int(),
  // Newest kind=cycle journal entry - the durable completion signal the host reads when the sentinel is mangled.
  lastCycle: z
    .object({
      cycleId: z.string().nullable(),
      completedAt: z.date(),
      status: z.enum(["ok", "empty", "error"]).nullable(),
      sleepSeconds: z.number().int().nullable(),
    })
    .nullable(),
});
