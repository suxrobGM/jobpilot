import type { PilotChangeAction } from "@jobpilot/contracts/pilot";
import { conflict, notFound } from "@/common/errors";
import { publishFeedUpdated } from "@/modules/feed/feed-events";
import type { ActionContext, ActionOf } from "./action-context";

/** Deleting the last search re-derives them; these dampers would otherwise hold that back. */
const SETUP_TASK_TYPES = ["search.setup", "research.explore"];

/** Searches the user still has; an archived one only keeps its jobs' history. */
const LIVE_SEARCH = { kind: "search", archivedAt: null } as const;

async function findSearch(ctx: ActionContext, searchId: string) {
  const search = await ctx.tx.feed.findFirst({
    where: { id: searchId, userId: ctx.userId, ...LIVE_SEARCH },
    select: {
      id: true,
      name: true,
      query: true,
      boardId: true,
      resumeId: true,
      reason: true,
      pausedAt: true,
      board: { select: { domain: true } },
    },
  });
  if (!search) {
    throw notFound("Search not found");
  }
  return search;
}

/** The searcher only opens the user's linked boards; undo leaves the link, which is harmless. */
async function linkBoard(ctx: ActionContext, boardId: string | null) {
  if (!boardId) {
    return;
  }
  await ctx.tx.userJobBoard.upsert({
    where: { userId_boardId: { userId: ctx.userId, boardId } },
    create: { userId: ctx.userId, boardId },
    update: {},
  });
}

async function assertUnique(
  ctx: ActionContext,
  query: string,
  boardId: string | null,
  exceptId: string | null,
) {
  const clash = await ctx.tx.feed.findFirst({
    where: {
      userId: ctx.userId,
      ...LIVE_SEARCH,
      query,
      boardId,
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  if (clash) {
    throw conflict("A search with this query and board already exists.");
  }
}

export async function createSearch(
  ctx: ActionContext,
  action: ActionOf<"search.create">,
): Promise<PilotChangeAction> {
  const boardId = action.board ? (ctx.boardIds.get(action.board) ?? null) : null;
  await assertUnique(ctx, action.query, boardId, null);
  await linkBoard(ctx, boardId);
  const created = await ctx.tx.feed.create({
    data: {
      userId: ctx.userId,
      kind: "search",
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

/** Undefined keeps the current board; null unpins. */
function boardIdFor(ctx: ActionContext, board: string | null | undefined, current: string | null) {
  if (board === undefined) {
    return current;
  }
  return board ? (ctx.boardIds.get(board) ?? null) : null;
}

export async function updateSearch(
  ctx: ActionContext,
  action: ActionOf<"search.update">,
): Promise<PilotChangeAction> {
  const old = await findSearch(ctx, action.searchId);
  const query = action.query ?? old.query ?? "";
  const boardId = boardIdFor(ctx, action.board, old.boardId);
  // A different query or board is a different search, so its schedule starts over.
  const boardChanged = boardId !== old.boardId;
  const changed = query !== old.query || boardChanged;
  if (changed) {
    await assertUnique(ctx, query, boardId, old.id);
  }
  if (boardChanged) {
    await linkBoard(ctx, boardId);
  }
  await ctx.tx.feed.update({
    where: { id: old.id },
    data: {
      name: action.name,
      query: action.query,
      boardId,
      reason: action.reason,
      ...(changed && {
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
    ...(action.query !== undefined && { query: old.query ?? "" }),
    ...(action.board !== undefined && { board: old.board?.domain ?? null }),
    ...(action.reason !== undefined && { reason: old.reason }),
  };
}

async function setPaused(ctx: ActionContext, searchId: string, paused: boolean) {
  const search = await findSearch(ctx, searchId);
  if (paused === (search.pausedAt !== null)) {
    throw conflict(paused ? "This search is already paused." : "This search isn't paused.");
  }
  await ctx.tx.feed.update({
    where: { id: search.id },
    data: paused
      ? { pausedAt: ctx.now, pausedBy: "user", pausedReason: null }
      : { pausedAt: null, pausedBy: null, pausedReason: null },
  });
  ctx.afterCommit.push(() => publishFeedUpdated(ctx.userId, search.id));
}

export async function pauseSearch(
  ctx: ActionContext,
  action: ActionOf<"search.pause">,
): Promise<PilotChangeAction> {
  await setPaused(ctx, action.searchId, true);
  return { type: "search.resume", searchId: action.searchId };
}

export async function resumeSearch(
  ctx: ActionContext,
  action: ActionOf<"search.resume">,
): Promise<PilotChangeAction> {
  await setPaused(ctx, action.searchId, false);
  return { type: "search.pause", searchId: action.searchId };
}

/** Archived, not deleted, so its jobs keep their history; undo starts a fresh search. */
export async function deleteSearch(
  ctx: ActionContext,
  action: ActionOf<"search.delete">,
): Promise<PilotChangeAction> {
  const { userId, tx, now } = ctx;
  const old = await findSearch(ctx, action.searchId);
  await tx.feed.update({ where: { id: old.id }, data: { archivedAt: now } });
  if ((await tx.feed.count({ where: { userId, ...LIVE_SEARCH } })) === 0) {
    await tx.pilotRun.deleteMany({ where: { userId, taskType: { in: SETUP_TASK_TYPES } } });
  }
  ctx.afterCommit.push(() => publishFeedUpdated(userId, old.id));
  return {
    type: "search.create",
    name: old.name,
    query: old.query ?? "",
    reason: old.reason,
    ...(old.board && { board: old.board.domain }),
    ...(old.resumeId && { resumeId: old.resumeId }),
  };
}
