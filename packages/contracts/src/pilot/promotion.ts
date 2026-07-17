import { z } from "zod/v4";
import { webLinkSchema } from "./web-link";

// ── Promotion posts ─────────────────────────────────────────────────────────────

const PROMOTION_STATUSES = [
  "draft",
  "approved",
  "declined",
  "posted",
  "failed",
  "skipped",
  "expired",
] as const;
const promotionStatusSchema = z.enum(PROMOTION_STATUSES);

/** Statuses past which a post is locked (no further editing or approval). */
export const PROMOTION_TERMINAL_STATUSES: readonly string[] = [
  "declined",
  "posted",
  "failed",
  "skipped",
  "expired",
];

/** Agent creates a draft post for a platform. */
export const createPromotionSchema = z.object({
  platform: z.string().min(1),
  target: z.string().optional(),
  title: z.string().optional(),
  body: z.string().min(1),
});

/** User edits the draft body/title, or moves draft → approved | declined, or schedules it. */
export const patchPromotionSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  status: z.enum(["approved", "declined"]).optional(),
  scheduledFor: z.iso.datetime().optional(),
});

const PROMOTION_OUTCOMES = ["posted", "failed", "skipped"] as const;
const promotionOutcomeSchema = z.enum(PROMOTION_OUTCOMES);

/** Agent reports the terminal outcome after posting. */
export const promotionResultSchema = z.object({
  outcome: promotionOutcomeSchema,
  postedUrl: webLinkSchema.optional(),
  note: z.string().optional(),
});

export const promotionsQuerySchema = z.object({ status: promotionStatusSchema.optional() });

export const promotionSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  platform: z.string(),
  target: z.string().nullable(),
  title: z.string().nullable(),
  body: z.string(),
  status: promotionStatusSchema,
  postedUrl: z.string().nullable(),
  scheduledFor: z.date().nullable(),
  postedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const promotionListSchema = z.array(promotionSchema);

export type PromotionStatus = z.infer<typeof promotionStatusSchema>;
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type PatchPromotionInput = z.infer<typeof patchPromotionSchema>;
export type PromotionResultInput = z.infer<typeof promotionResultSchema>;
export type Promotion = z.infer<typeof promotionSchema>;
