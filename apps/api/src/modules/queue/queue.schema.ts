import { queueStatusSchema } from "@jobpilot/contracts/queue";
import { z } from "zod/v4";

export const queueListQuery = z.object({ status: z.string().trim().min(1).optional() });

// ── Response schemas ──────────────────────────────────────────────────────────

/** A serialized queue entry (mirrors the service's `QueueEntryRow`). */
export const queueEntrySchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  url: z.string(),
  note: z.string().nullable(),
  status: queueStatusSchema,
  createdAt: z.date(),
  consumedAt: z.date().nullable(),
});

/** A list of queue entries. */
export const queueListSchema = z.array(queueEntrySchema);

/** Result of upserting job URLs into the queue — inserted count plus the entries. */
export const queueAddedSchema = z.object({
  inserted: z.number().int(),
  items: z.array(queueEntrySchema),
});
