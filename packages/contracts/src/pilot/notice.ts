import { z } from "zod/v4";
import { storedDate } from "../utils/json";
import { pilotChangeActionSchema } from "./change";
import { createPilotRequestSchema } from "./request";

const PILOT_NOTICE_KEYS = [
  "email.missing",
  "inbox.unread",
  "outcomes.none",
  "score.nearMiss",
  "cap.unused",
] as const;

const pilotNoticeKeySchema = z.enum(PILOT_NOTICE_KEYS);
export type PilotNoticeKey = z.infer<typeof pilotNoticeKeySchema>;

/** What the notice's button does: queue work, ask the pilot, suggest a change, or go somewhere. */
const pilotNoticeActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("request"), label: z.string(), request: createPilotRequestSchema }),
  z.object({ kind: z.literal("message"), label: z.string(), body: z.string() }),
  z.object({
    kind: z.literal("change"),
    label: z.string(),
    summary: z.string(),
    actions: z.array(pilotChangeActionSchema).min(1),
  }),
  z.object({ kind: z.literal("link"), label: z.string(), href: z.string() }),
]);

const pilotNoticeSchema = z.object({
  key: pilotNoticeKeySchema,
  title: z.string(),
  body: z.string(),
  action: pilotNoticeActionSchema,
});

export type PilotNotice = z.infer<typeof pilotNoticeSchema>;

export const pilotNoticeListSchema = z.array(pilotNoticeSchema);
export const pilotNoticeParamsSchema = z.object({ key: pilotNoticeKeySchema });

/** Stored per user: notice key to when it may show again. */
export const dismissedNoticesSchema = z.partialRecord(pilotNoticeKeySchema, storedDate);
