import {
  applicationEventKindSchema,
  applicationEventSourceSchema,
  applicationFilterSchema,
  statusSchema,
} from "@jobpilot/contracts/application";
import { paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";
import { campaignJobSchema } from "@/modules/campaign/campaign.schema";
import { contactSchema } from "@/modules/contact/contact.schema";
import { emailMessageSchema } from "@/modules/email/email.schema";

export const applicationListQuerySchema = paginationQuerySchema.extend(
  applicationFilterSchema.shape,
);

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

// Response schemas

/** A full applied-job row (mirrors the `Application` Prisma model with dates stringified). */
export const applicationSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
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
});

export const applicationListSchema = paginatedSchema(applicationSchema);

/**
 * Per-status totals across every application matching the filters *except* `status` - the funnel
 * tiles and the workspace stat tiles read these, so their counts are not page-scoped.
 */
export const applicationSummarySchema = z.object({
  total: z.number().int(),
  byStatus: z.record(statusSchema, z.number().int()),
});

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

const applicationResumeVariantSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  diffNotes: z.string().nullable(),
  createdAt: z.date(),
});

const applicationCoverLetterSchema = z.object({
  id: z.uuid(),
  createdAt: z.date(),
});

// Picked from the owning modules' schemas: a column rename breaks the build instead of splitting the wire shape.
const applicationEmailSchema = emailMessageSchema
  .pick({ id: true, subject: true, fromName: true, receivedAt: true })
  // Free String column; only the email module's own mapper narrows it to the enum.
  .extend({ classification: z.string().nullable() });

const applicationContactSchema = contactSchema.pick({
  id: true,
  name: true,
  title: true,
  company: true,
  email: true,
  linkedinUrl: true,
});

/** The campaign job this application came from, for its posting text. */
const applicationJobSchema = campaignJobSchema.pick({
  description: true,
  salary: true,
  type: true,
});

/** A single application with the documents sent, the posting, and everything that came back. */
export const applicationDetailSchema = applicationSchema.extend({
  events: z.array(applicationEventSchema),
  resumeVariants: z.array(applicationResumeVariantSchema),
  coverLetters: z.array(applicationCoverLetterSchema),
  emailMessages: z.array(applicationEmailSchema),
  contacts: z.array(applicationContactSchema),
  job: applicationJobSchema.nullable(),
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
