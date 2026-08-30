import { pilotCycleStatusSchema, pilotJournalEntrySchema } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { SKIP_BUCKETS } from "./pilot.stats";

/** Rows created by a batch journal append. */
export const createPilotJournalResponseSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
});

/** Today's non-applied outcomes, so the overview can say why a cycle-heavy day produced few applies. */
export const pilotTodayOutcomesSchema = z.object({
  skipped: z.number().int(),
  failed: z.number().int(),
  skipReasons: z.array(z.object({ reason: z.enum(SKIP_BUCKETS), count: z.number().int() })),
});

/** Where the last week of cycles went, by agenda kind, heaviest first. */
export const pilotCostSchema = z.object({
  items: z.array(
    z.object({
      kind: z.string(),
      runs: z.number().int(),
      medianMs: z.number().int(),
      totalMs: z.number().int(),
      failed: z.number().int(),
      abandoned: z.number().int(),
    }),
  ),
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
