import { AUTO_APPLY_FEED_KINDS } from "@jobpilot/contracts/feed";
import type { PilotChangeAction } from "@jobpilot/contracts/pilot";
import type { JobStatus, Prisma, PrismaClient } from "@/generated/prisma/client";
import { publishJobUpdated } from "@/modules/feed/jobs/job-events";
import type { ActionContext, ActionOf } from "./action-context";

/** Jobs still on their way; anything applied, applying or finished is left alone. */
const SKIPPABLE: JobStatus[] = ["queued", "pending", "approved", "needs_user"];

/** The undo's `jobs.restore` holds at most this many refs. */
const MAX_SKIPPED = 500;

const RESTORED_REASON = "Restored, then skipped again.";

const APPROVED_AUTO_APPLY: Prisma.JobWhereInput = {
  status: "approved",
  feed: { kind: { in: [...AUTO_APPLY_FEED_KINDS] } },
};

async function skipWhere(
  ctx: ActionContext,
  where: Prisma.JobWhereInput,
  reason: string,
): Promise<PilotChangeAction> {
  const jobs = await ctx.tx.job.findMany({
    where: { ...where, userId: ctx.userId },
    take: MAX_SKIPPED,
    select: { id: true, feedId: true, key: true, status: true },
  });
  if (jobs.length > 0) {
    await ctx.tx.job.updateMany({
      where: { id: { in: jobs.map((job) => job.id) } },
      data: { status: "skipped", skipReason: reason },
    });
    ctx.afterCommit.push(() => {
      for (const job of jobs) {
        publishJobUpdated(ctx.userId, { ...job, status: "skipped" });
      }
    });
  }
  return {
    type: "jobs.restore",
    refs: jobs.map((job) => ({ feedId: job.feedId, key: job.key, status: job.status })),
  };
}

export function skipJobs(ctx: ActionContext, action: ActionOf<"jobs.skip">) {
  const refs = action.refs.map((ref) => ({ feedId: ref.feedId, key: ref.key }));
  return skipWhere(ctx, { OR: refs, status: { in: SKIPPABLE } }, action.reason);
}

export function skipApprovedJobs(ctx: ActionContext, action: ActionOf<"jobs.skipApproved">) {
  return skipWhere(ctx, APPROVED_AUTO_APPLY, action.reason);
}

/** How many jobs a `jobs.skipApproved` change would skip right now. */
export async function countSkippableApproved(prisma: PrismaClient, userId: string) {
  const count = await prisma.job.count({ where: { ...APPROVED_AUTO_APPLY, userId } });
  return Math.min(count, MAX_SKIPPED);
}

export async function restoreJobs(
  ctx: ActionContext,
  action: ActionOf<"jobs.restore">,
): Promise<PilotChangeAction> {
  const restored: ActionOf<"jobs.restore">["refs"] = [];
  for (const ref of action.refs) {
    // Only rows still skipped: one the pilot has since picked up stays where it is.
    const { count } = await ctx.tx.job.updateMany({
      where: { userId: ctx.userId, feedId: ref.feedId, key: ref.key, status: "skipped" },
      data: { status: ref.status, skipReason: null },
    });
    if (count > 0) {
      restored.push(ref);
    }
  }
  if (restored.length === 0) {
    return { type: "jobs.restore", refs: [] };
  }
  ctx.afterCommit.push(() => {
    for (const ref of restored) {
      publishJobUpdated(ctx.userId, ref);
    }
  });
  const refs = restored.map((ref) => ({ feedId: ref.feedId, key: ref.key }));
  return { type: "jobs.skip", refs, reason: RESTORED_REASON };
}
