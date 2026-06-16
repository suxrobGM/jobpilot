import { z } from "zod/v4";

export const campaignParams = z.object({ id: z.string() });
export const campaignJobParams = z.object({ id: z.string(), key: z.string() });

export const outreachMessageParams = z.object({
  id: z.string(),
  messageId: z.coerce.number().int().positive(),
});

export const campaignsQuery = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
});
