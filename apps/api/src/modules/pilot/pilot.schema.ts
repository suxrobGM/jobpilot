import { pilotJournalEntrySchema } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";

/** Rows created by a batch journal append. */
export const createPilotJournalResponseSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
});
