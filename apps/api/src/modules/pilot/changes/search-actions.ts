import type { PilotChangeAction } from "@jobpilot/contracts/pilot";
import { conflict, notFound } from "@/common/errors";
import type { CampaignStatus } from "@/generated/prisma/client";
import { publishCampaignStatus } from "@/modules/campaign/campaign.utils";
import type { ActionContext, ActionOf } from "./action-context";

/** Deleting the last search re-derives them; these dampers would otherwise hold that back. */
const SETUP_TASK_TYPES = ["search.setup", "research.explore"];

async function findSearch(ctx: ActionContext, searchId: string) {
  const search = await ctx.tx.pilotSearch.findFirst({
    where: { id: searchId, userId: ctx.userId },
    select: {
      id: true,
      name: true,
      query: true,
      boardId: true,
      resumeId: true,
      reason: true,
      board: { select: { domain: true } },
    },
  });
  if (!search) throw notFound("Search not found");
  return search;
}

async function assertUnique(
  ctx: ActionContext,
  query: string,
  boardId: string | null,
  exceptId: string | null,
) {
  const clash = await ctx.tx.pilotSearch.findFirst({
    where: { userId: ctx.userId, query, boardId, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true },
  });
  if (clash) throw conflict("A search with this query and board already exists.");
}

export async function createSearch(
  ctx: ActionContext,
  action: ActionOf<"search.create">,
): Promise<PilotChangeAction> {
  const boardId = action.board ? (ctx.boardIds.get(action.board) ?? null) : null;
  await assertUnique(ctx, action.query, boardId, null);
  const created = await ctx.tx.pilotSearch.create({
    data: {
      userId: ctx.userId,
      name: action.name,
      query: action.query,
      boardId,
      resumeId: action.resumeId ?? null,
      reason: action.reason,
    },
    select: { id: true },
  });
  return { type: "search.delete", searchId: created.id };
}

export async function updateSearch(
  ctx: ActionContext,
  action: ActionOf<"search.update">,
): Promise<PilotChangeAction> {
  const old = await findSearch(ctx, action.searchId);
  const query = action.query ?? old.query;
  // A different query is a different search, so its schedule starts over.
  const newQuery = query !== old.query;
  if (newQuery) await assertUnique(ctx, query, old.boardId, old.id);
  await ctx.tx.pilotSearch.update({
    where: { id: old.id },
    data: {
      name: action.name,
      query: action.query,
      reason: action.reason,
      ...(newQuery && {
        emptyRuns: 0,
        nextRunAt: ctx.now,
        lastJobsScanned: null,
        lastNewJobs: null,
      }),
    },
  });
  return {
    type: "search.update",
    searchId: old.id,
    ...(action.name !== undefined && { name: old.name }),
    ...(action.query !== undefined && { query: old.query }),
    ...(action.reason !== undefined && { reason: old.reason }),
  };
}

/** Pausing a search pauses its standing campaign, which discovery skips. */
async function moveStandingCampaign(
  ctx: ActionContext,
  searchId: string,
  from: CampaignStatus,
  to: CampaignStatus,
) {
  await findSearch(ctx, searchId);
  const moved = await ctx.tx.campaign.updateManyAndReturn({
    where: { userId: ctx.userId, pilotSearchId: searchId, status: from },
    data: { status: to, statusChangedBy: "user", statusReason: null },
    select: { id: true, source: true },
  });
  if (moved.length === 0) {
    throw conflict(
      to === "paused"
        ? "This search isn't running, so there's nothing to pause."
        : "This search isn't paused.",
    );
  }
  ctx.afterCommit.push(() => {
    for (const campaign of moved) publishCampaignStatus(ctx.userId, campaign, to);
  });
}

export async function pauseSearch(
  ctx: ActionContext,
  action: ActionOf<"search.pause">,
): Promise<PilotChangeAction> {
  await moveStandingCampaign(ctx, action.searchId, "in_progress", "paused");
  return { type: "search.resume", searchId: action.searchId };
}

export async function resumeSearch(
  ctx: ActionContext,
  action: ActionOf<"search.resume">,
): Promise<PilotChangeAction> {
  await moveStandingCampaign(ctx, action.searchId, "paused", "in_progress");
  return { type: "search.pause", searchId: action.searchId };
}

/** Its open campaign completes; job history stays with it, and undo starts a fresh search. */
export async function deleteSearch(
  ctx: ActionContext,
  action: ActionOf<"search.delete">,
): Promise<PilotChangeAction> {
  const { userId, tx, now } = ctx;
  const old = await findSearch(ctx, action.searchId);
  const completed = await tx.campaign.updateManyAndReturn({
    where: { userId, pilotSearchId: old.id, status: { in: ["in_progress", "paused"] } },
    data: {
      status: "completed",
      statusChangedBy: "user",
      statusReason: "Search deleted.",
      completedAt: now,
    },
    select: { id: true, source: true },
  });
  await tx.pilotSearch.delete({ where: { id: old.id } });
  if ((await tx.pilotSearch.count({ where: { userId } })) === 0) {
    await tx.pilotRun.deleteMany({ where: { userId, taskType: { in: SETUP_TASK_TYPES } } });
  }
  ctx.afterCommit.push(() => {
    for (const campaign of completed) publishCampaignStatus(userId, campaign, "completed");
  });
  return {
    type: "search.create",
    name: old.name,
    query: old.query,
    reason: old.reason,
    ...(old.board && { board: old.board.domain }),
    ...(old.resumeId && { resumeId: old.resumeId }),
  };
}
