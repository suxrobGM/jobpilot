import {
  applicationEventKindSchema,
  applicationEventSourceSchema,
  statusSchema,
} from "@jobpilot/contracts/application";
import { z } from "zod/v4";

export const applicationListQuerySchema = z.object({
  status: statusSchema.optional(),
  board: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const applicationQuerySchema = z.object({
  url: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  company: z.string().trim().min(1).optional(),
});

/** Append a free-text note to an application's timeline (e.g. a generated interview prep sheet). */
export const appendNoteSchema = z.object({
  kind: z.literal("note"),
  notes: z.string().min(1),
});

// ── Response schemas ──────────────────────────────────────────────────────────

/** A full applied-job row (mirrors the `Application` Prisma model with dates stringified). */
export const applicationSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  url: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  board: z.string().nullable(),
  // Free-text column: stores ApplicationSource values *and* campaign sources
  // ("search"/"networking") written when an Application is created from a campaign job.
  source: z.string(),
  appliedAt: z.date(),
  status: statusSchema,
  rejectedAt: z.date().nullable(),
  matchScore: z.number().int().nullable(),
  matchReason: z.string().nullable(),
  failReason: z.string().nullable(),
  campaignId: z.string().nullable(),
  normalizedTitle: z.string(),
  normalizedCompany: z.string(),
});

export const applicationListSchema = z.array(applicationSchema);

/** An activity-timeline event (mirrors the `ApplicationEvent` Prisma model with dates stringified). */
export const applicationEventSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  kind: applicationEventKindSchema,
  fromStatus: statusSchema.nullable(),
  toStatus: statusSchema.nullable(),
  note: z.string().nullable(),
  source: applicationEventSourceSchema.nullable(),
  createdAt: z.date(),
});

/** A single application with its chronological activity history. */
export const applicationDetailSchema = applicationSchema.extend({
  events: z.array(applicationEventSchema),
});

/** The application summary embedded in a duplicate-check match. */
export const duplicateMatchApplicationSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  title: z.string(),
  company: z.string(),
  appliedAt: z.date(),
  status: statusSchema,
});

/** Result of a duplicate check - `applied` flag with the matching application when found. */
export const applicationCheckSchema = z.union([
  z.object({
    applied: z.literal(true),
    match: z.union([
      z.object({
        kind: z.literal("url"),
        application: duplicateMatchApplicationSchema,
      }),
      z.object({
        kind: z.literal("fuzzy"),
        score: z.number(),
        application: duplicateMatchApplicationSchema,
      }),
    ]),
  }),
  z.object({
    applied: z.literal(false),
    match: z.null(),
  }),
]);

/** Result of a status transition - id and the new status (`unchanged` when already in that status). */
export const statusTransitionResultSchema = z.object({
  id: z.uuid(),
  status: statusSchema,
  unchanged: z.boolean().optional(),
});
