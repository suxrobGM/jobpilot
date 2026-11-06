import { statusSchema } from "@jobpilot/contracts/application";
import { paginatedSchema } from "@jobpilot/contracts/pagination";
import { tokenUsageSchema } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import { publicUserSchema } from "@/modules/auth/auth.schema";

export const adminUserSchema = publicUserSchema.extend({
  name: z.string().nullable(),
  applicationCount: z.number().int(),
  lastActiveAt: z.date().nullable(),
  /** Whether the calling admin may change this row's role; the UI must not re-derive it. */
  canChangeRole: z.boolean(),
});

export const adminUserPageSchema = paginatedSchema(adminUserSchema);

const adminPilotSchema = z.object({
  userEmail: z.string(),
  userId: z.uuid(),
  autopilot: z.boolean(),
  lastCycleAt: z.date().nullable(),
  cycleCount: z.number().int(),
  openQuestions: z.number().int(),
  /** Token usage over runs started in the last 7 days. */
  weekTokens: tokenUsageSchema,
});

export const adminPilotPageSchema = paginatedSchema(adminPilotSchema);

/** `signupsPerDay.date` is UTC midnight of the bucketed day. */
export const adminStatsSchema = z.object({
  users: z.object({
    total: z.number().int(),
    verified: z.number().int(),
    admins: z.number().int(),
    newThisWeek: z.number().int(),
    active: z.number().int(),
  }),
  content: z.object({
    feeds: z.number().int(),
    activeFeeds: z.number().int(),
    applications: z.number().int(),
    applicationsThisWeek: z.number().int(),
    boards: z.number().int(),
    boardLinks: z.number().int(),
  }),
  statusBreakdown: z.array(z.object({ status: statusSchema, count: z.number().int() })),
  topBoards: z.array(z.object({ board: z.string(), count: z.number().int() })),
  signupsPerDay: z.array(z.object({ date: z.date(), count: z.number().int() })),
});
