import { pilotJournalEntrySchema } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";

/** Rows created by a batch journal append. */
export const createPilotJournalResponseSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
});

/** Watchdog liveness probe: newest server-side agent activity + the active-lease count. */
export const pilotActivityResponseSchema = z.object({
  lastActivityAt: z.date().nullable(),
  activeLeases: z.number().int(),
});
