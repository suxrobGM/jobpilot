import { z } from "zod/v4";
import { publicUserSchema } from "@/modules/auth/auth.schema";
import { paginatedResponseSchema } from "@/types/response";

// ── Response schemas ──────────────────────────────────────────────────────────

/** A user as the admin table sees them: the public user plus activity and the caller's rights. */
export const adminUserSchema = publicUserSchema.extend({
  name: z.string().nullable(),
  applicationCount: z.number().int(),
  lastActiveAt: z.date().nullable(),
  /** Whether the *calling* admin may change this row's role - the server owns that policy. */
  canChangeRole: z.boolean(),
});

export const adminUserPageSchema = paginatedResponseSchema(adminUserSchema);

/** One Pilot in the admin fleet view: its owner, run state, and cycle/question activity. */
export const adminPilotSchema = z.object({
  userEmail: z.string(),
  userId: z.uuid(),
  running: z.boolean(),
  lastCycleAt: z.date().nullable(),
  cycleCount: z.number().int(),
  openQuestions: z.number().int(),
});

export const adminPilotPageSchema = paginatedResponseSchema(adminPilotSchema);

/** Platform-wide counters. `signupsPerDay.date` is UTC midnight of the bucketed day. */
export const adminStatsSchema = z.object({
  users: z.object({
    total: z.number().int(),
    verified: z.number().int(),
    admins: z.number().int(),
    newThisWeek: z.number().int(),
    active: z.number().int(),
  }),
  content: z.object({
    campaigns: z.number().int(),
    activeCampaigns: z.number().int(),
    applications: z.number().int(),
    applicationsThisWeek: z.number().int(),
    boards: z.number().int(),
    boardLinks: z.number().int(),
  }),
  statusBreakdown: z.array(z.object({ status: z.string(), count: z.number().int() })),
  topBoards: z.array(z.object({ board: z.string(), count: z.number().int() })),
  signupsPerDay: z.array(z.object({ date: z.date(), count: z.number().int() })),
});
