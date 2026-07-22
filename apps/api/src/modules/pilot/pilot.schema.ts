import { pilotCycleStatusSchema, pilotJournalEntrySchema } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";

/** Rows created by a batch journal append. */
export const createPilotJournalResponseSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
});

/** Orchestrator liveness probe: newest server-side agent activity + the active-claim count. */
export const pilotActivityResponseSchema = z.object({
  lastActivityAt: z.date().nullable(),
  activeClaims: z.number().int(),
  // The host's pre-inject gate reads run-state from here, so a probe costs no PilotState write.
  running: z.boolean(),
  // Newest kind=cycle journal entry - the durable completion signal the host reads when the sentinel is mangled.
  lastCycle: z
    .object({
      cycleId: z.string().nullable(),
      completedAt: z.date(),
      status: pilotCycleStatusSchema.nullable(),
      sleepSeconds: z.number().int().nullable(),
    })
    .nullable(),
});
