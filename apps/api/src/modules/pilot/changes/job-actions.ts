import type { PilotChangeAction } from "@jobpilot/contracts/pilot";
import type { CampaignJobStatus } from "@/generated/prisma/client";
import type { ActionContext, ActionOf } from "./action-context";

/** Jobs still on their way; anything applied, applying or finished is left alone. */
const SKIPPABLE: CampaignJobStatus[] = ["queued", "pending", "approved", "needs_user"];

const RESTORED_REASON = "Restored, then skipped again.";

function refWhere(ctx: ActionContext, refs: { campaignId: string; key: string }[]) {
  return {
    userId: ctx.userId,
    OR: refs.map((ref) => ({ campaignId: ref.campaignId, key: ref.key })),
  };
}

export async function skipJobs(
  ctx: ActionContext,
  action: ActionOf<"jobs.skip">,
): Promise<PilotChangeAction> {
  const jobs = await ctx.tx.campaignJob.findMany({
    where: { ...refWhere(ctx, action.refs), status: { in: SKIPPABLE } },
    select: { id: true, campaignId: true, key: true, status: true },
  });
  if (jobs.length > 0) {
    await ctx.tx.campaignJob.updateMany({
      where: { id: { in: jobs.map((job) => job.id) } },
      data: { status: "skipped", skipReason: action.reason },
    });
  }
  return {
    type: "jobs.restore",
    refs: jobs.map((job) => ({ campaignId: job.campaignId, key: job.key, status: job.status })),
  };
}

export async function restoreJobs(
  ctx: ActionContext,
  action: ActionOf<"jobs.restore">,
): Promise<PilotChangeAction> {
  const restored: { campaignId: string; key: string }[] = [];
  for (const ref of action.refs) {
    // Only rows still skipped: one the pilot has since picked up stays where it is.
    const { count } = await ctx.tx.campaignJob.updateMany({
      where: { userId: ctx.userId, campaignId: ref.campaignId, key: ref.key, status: "skipped" },
      data: { status: ref.status, skipReason: null },
    });
    if (count > 0) restored.push({ campaignId: ref.campaignId, key: ref.key });
  }
  if (restored.length === 0) return { type: "jobs.restore", refs: [] };
  return { type: "jobs.skip", refs: restored, reason: RESTORED_REASON };
}
