import { z } from "zod/v4";
import { queryText } from "./pagination";

export const APPLICATION_STATUSES = [
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export const statusSchema = z.enum(APPLICATION_STATUSES);

/** Actively interviewing: past `applied`, not yet an outcome. `offer` is counted on its own. */
export const INTERVIEW_STATUSES = [
  "screening",
  "interviewing",
] as const satisfies readonly (typeof APPLICATION_STATUSES)[number][];
/** Superset of FeedSource: a row created from a feed job carries that feed's source. */
export const APPLICATION_SOURCES = [
  "apply",
  "auto_apply",
  "manual",
  "search",
  "networking",
] as const;
export const applicationSourceSchema = z.enum(APPLICATION_SOURCES);

/** Activity-timeline event kinds on an application. */
export const APPLICATION_EVENT_KINDS = [
  "status_change",
  "note",
  "email",
  "interview_prep",
] as const;
export const applicationEventKindSchema = z.enum(APPLICATION_EVENT_KINDS);

/** What originated an activity event. */
export const APPLICATION_EVENT_SOURCES = ["manual", "email", "feed"] as const;
export const applicationEventSourceSchema = z.enum(APPLICATION_EVENT_SOURCES);

export const statusTransitionSchema = z.object({
  toStatus: statusSchema,
  note: z.string().optional().nullable(),
});

/** The sentinel `?feedId=` value meaning "applications not attributed to any feed". */
export const SINGLE_APPLY_FEED = "none";

/** Every filter the workspace applies, so a page reflects the whole account rather than itself. */
export const applicationFilterSchema = z.object({
  status: statusSchema.optional(),
  board: z.string().trim().min(1).optional(),
  source: applicationSourceSchema.optional(),
  search: queryText.optional(),
  /** A feed id, or {@link SINGLE_APPLY_FEED} for rows with no feed. */
  feedId: z.union([z.uuid(), z.literal(SINGLE_APPLY_FEED)]).optional(),
});

export type ApplicationFilters = z.infer<typeof applicationFilterSchema>;
export type ApplicationStatus = z.infer<typeof statusSchema>;
export type ApplicationSource = z.infer<typeof applicationSourceSchema>;
export type ApplicationEventSource = z.infer<typeof applicationEventSourceSchema>;
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;
