import { z } from "zod/v4";

export const QUEUE_STATUSES = ["pending", "consumed", "skipped"] as const;
export const queueStatusSchema = z.enum(QUEUE_STATUSES);

export const addQueueSchema = z.object({
  urls: z.array(z.url()).min(1),
  note: z.string().optional().nullable(),
});

export const patchQueueSchema = z.object({
  status: queueStatusSchema,
});

export type QueueStatus = z.infer<typeof queueStatusSchema>;
export type AddQueueEntry = z.infer<typeof addQueueSchema>;
export type PatchQueueEntry = z.infer<typeof patchQueueSchema>;
