import { z } from "zod/v4";

export const messagesQuery = z.object({
  reviewStatus: z.string().optional(),
  classification: z.string().optional(),
  since: z.string().optional(),
  domainHint: z.string().optional(),
  verificationDomain: z.string().optional(),
});

export const startQuery = z.object({ provider: z.string().optional() });

export const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});
