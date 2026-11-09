import { z } from "zod/v4";

export const PILOT_MESSAGE_AUTHORS = ["user", "pilot"] as const;

export const createPilotMessageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export const pilotMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const pilotMessageSchema = z.object({
  id: z.uuid(),
  author: z.enum(PILOT_MESSAGE_AUTHORS),
  /** Markdown when the pilot wrote it. */
  body: z.string(),
  runId: z.uuid().nullable(),
  /** User messages only: when a chat reply answered it. */
  answeredAt: z.date().nullable(),
  createdAt: z.date(),
});

/** Oldest first, so a reader takes them in conversation order. */
export const pilotMessageListSchema = z.array(pilotMessageSchema);

export type PilotMessage = z.infer<typeof pilotMessageSchema>;
