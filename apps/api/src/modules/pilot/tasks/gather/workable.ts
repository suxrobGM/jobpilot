import { Prisma } from "@/generated/prisma/client";
import { LIVE_AUTO_APPLY_FEED } from "@/modules/feed/jobs/apply-guard";

// One definition of "still workable" per task type, shared by its gather and the run-start
// re-check: two copies drift, and a looser re-check starts a run on a row the gather would drop.
// `job.apply`'s lives beside `startApplying` in feed/jobs/apply-guard.ts.

/** Pending rows a worker must open: never scored, or scored off a results row without a brief. */
export const NEEDS_WORKER_VISIT = {
  status: "pending",
  OR: [{ matchScore: null }, { brief: { equals: Prisma.DbNull } }],
} satisfies Prisma.JobWhereInput;

export function scorePendingWhere(userId: string): Prisma.FeedWhereInput {
  return {
    userId,
    ...LIVE_AUTO_APPLY_FEED,
    jobs: { some: NEEDS_WORKER_VISIT },
  };
}

/** A search the user paused is their call, so only one the pilot or agent paused is asked about. */
export function reviewPausedWhere(userId: string): Prisma.FeedWhereInput {
  return {
    userId,
    kind: "search",
    archivedAt: null,
    pausedAt: { not: null },
    // Not `NOT { pausedBy: "user" }`: that is NULL in SQL for rows with no actor.
    OR: [{ pausedBy: null }, { pausedBy: { in: ["agent", "pilot"] } }],
  };
}

/** Email drafts only: LinkedIn drafts are never sent by the pilot. */
export function networkingSendWhere(userId: string): Prisma.NetworkingMessageWhereInput {
  return {
    userId,
    feedId: { not: null },
    channel: "email",
    status: "approved",
    contact: { email: { not: null } },
  };
}
