import { stageSchema } from "@jobpilot/contracts/application";
import { z } from "zod/v4";

export const applicationListQuerySchema = z.object({
  stage: z.string().trim().min(1).optional(),
  board: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const applicationQuerySchema = z.object({
  url: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  company: z.string().trim().min(1).optional(),
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
  // ("search"/"outreach") written when an Application is created from a campaign job.
  source: z.string(),
  appliedAt: z.date(),
  stage: stageSchema,
  outcome: z.string().nullable(),
  rejectedAt: z.date().nullable(),
  matchScore: z.number().int().nullable(),
  matchReason: z.string().nullable(),
  failReason: z.string().nullable(),
  campaignId: z.string().nullable(),
  normalizedTitle: z.string(),
  normalizedCompany: z.string(),
});

export const applicationListSchema = z.array(applicationSchema);

/** A stage transition event (mirrors the `StageEvent` Prisma model with dates stringified). */
export const stageEventSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  fromStage: stageSchema.nullable(),
  toStage: stageSchema,
  note: z.string().nullable(),
  occurredAt: z.date(),
});

/** A single application with its chronological stage-event history. */
export const applicationDetailSchema = applicationSchema.extend({
  stageEvents: z.array(stageEventSchema),
});

/** The application summary embedded in a duplicate-check match. */
export const duplicateMatchApplicationSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  title: z.string(),
  company: z.string(),
  appliedAt: z.date(),
  stage: stageSchema,
});

/** Result of a duplicate check — `applied` flag with the matching application when found. */
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

/** Result of a stage transition — id and the new stage (`unchanged` when already in that stage). */
export const stageTransitionResultSchema = z.object({
  id: z.uuid(),
  stage: stageSchema,
  unchanged: z.boolean().optional(),
});
