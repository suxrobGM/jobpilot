import { Prisma } from "@/generated/prisma/client";

// One definition of "still workable" per task type, shared by its gather and the run-start
// re-check: two copies drift, and a looser re-check starts a run on a row the gather would drop.
// `job.apply`'s lives beside `startApplying` in campaign/jobs/apply-guard.ts.

/** Pending rows a worker must open: never scored, or scored off a results row without a brief. */
export const NEEDS_WORKER_VISIT = {
  status: "pending",
  OR: [{ matchScore: null }, { brief: { equals: Prisma.DbNull } }],
} satisfies Prisma.CampaignJobWhereInput;

export function scorePendingWhere(userId: string): Prisma.CampaignWhereInput {
  return {
    userId,
    status: "in_progress",
    source: "auto_apply",
    jobs: { some: NEEDS_WORKER_VISIT },
  };
}

/** A standing campaign the user paused is their way of pausing its feed, so it isn't asked about. */
export function reviewPausedWhere(userId: string): Prisma.CampaignWhereInput {
  return {
    userId,
    status: "paused",
    source: "auto_apply",
    // Not `NOT { statusChangedBy: "user" }`: that is NULL in SQL for rows with no actor.
    OR: [
      { feed: null, pilotSearchId: null },
      { statusChangedBy: null },
      { statusChangedBy: { in: ["agent", "pilot"] } },
    ],
  };
}

/** Email drafts only: LinkedIn drafts are never sent by the pilot. */
export function networkingSendWhere(userId: string): Prisma.NetworkingMessageWhereInput {
  return {
    userId,
    campaignId: { not: null },
    channel: "email",
    status: "approved",
    contact: { email: { not: null } },
  };
}

/** Approved posts whose schedule, if any, has arrived. */
export function promotionPostWhere(userId: string, now: Date): Prisma.PromotionPostWhereInput {
  return {
    userId,
    status: "approved",
    OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
  };
}
