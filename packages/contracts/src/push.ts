import { z } from "zod/v4";

// ── Web push ──────────────────────────────────────────────────────────────────

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().optional(),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().min(1) });

export const vapidKeySchema = z.object({ publicKey: z.string().nullable() });

/** Returned on subscribe; the browser needs only the id/endpoint back. */
export const pushSubscriptionSchema = z.object({
  id: z.uuid(),
  endpoint: z.string(),
  createdAt: z.date(),
});

/** Device row for the manage-devices list. */
const pushSubscriptionListItemSchema = z.object({
  id: z.uuid(),
  endpoint: z.string(),
  userAgent: z.string().nullable(),
  createdAt: z.date(),
});

export const pushSubscriptionListSchema = z.array(pushSubscriptionListItemSchema);

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;
export type PushSubscriptionDto = z.infer<typeof pushSubscriptionSchema>;
