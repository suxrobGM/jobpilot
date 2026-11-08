import type { CreatePilotRequestInput, PilotConfig, PilotTask } from "@jobpilot/contracts/pilot";
import { parseRequest, publishRequest } from "../../requests/request-row";
import { applyTask, discoveryBoard, SEARCH_MAX_PAGES } from "../build";
import { makeTask, REQUEST_PRIORITY } from "../task-defs";
import type { GatherContext } from "./gather-context";
import { gatherInbox } from "./inbox";
import { findJobAlerts } from "./job-alerts";
import { findApprovedJob } from "./jobs";
import { researchPayload } from "./research";

/** Requests waiting at once; more just wait a cycle. */
const REQUEST_BATCH = 20;
const SEARCH_NEW_JOBS_TARGET = 10;

interface RequestPilot {
  config: PilotConfig;
  cycleCount: number;
}

interface RequestContext extends GatherContext, RequestPilot {
  requestId: string;
}

/** The task a request asks for, or null when its subject is gone and it can't run. */
async function requestTask(
  ctx: RequestContext,
  input: CreatePilotRequestInput,
): Promise<PilotTask | null> {
  const { prisma, userId, requestId, config } = ctx;
  switch (input.taskType) {
    case "job.apply": {
      const { feedId, jobKey } = input.payload;
      const job = await findApprovedJob(ctx, feedId, jobKey);
      return job && applyTask(job, false);
    }
    case "job.rescanSkipped": {
      const { feedId, jobKeys } = input.payload;
      const skippedCount =
        jobKeys?.length ??
        (await prisma.job.count({ where: { userId, feedId, status: "skipped" } }));
      return makeTask("job.rescanSkipped", { feedId, skippedCount, jobKeys });
    }
    case "job.retryFailed": {
      const { feedId } = input.payload;
      const failedCount = await prisma.job.count({
        where: { userId, feedId, status: "failed" },
      });
      return failedCount > 0 ? makeTask("job.retryFailed", { feedId, failedCount }) : null;
    }
    case "inbox.review": {
      const { messageIds } = input.payload;
      const inbox = messageIds ? { messageIds, count: messageIds.length } : await gatherInbox(ctx);
      return inbox.count > 0 ? makeTask("inbox.review", inbox) : null;
    }
    case "upwork.syncInbox":
      return makeTask("upwork.syncInbox", { lastSyncedAt: null, unreadCount: 0 });
    case "search.discover": {
      const search = await prisma.feed.findFirst({
        where: { id: input.payload.searchId, userId, kind: "search", archivedAt: null },
        select: { id: true, query: true, resumeId: true, board: { select: { domain: true } } },
      });
      const board = discoveryBoard(config.boards, ctx.cycleCount, search?.board?.domain);
      if (!search || !board) {
        return null;
      }
      return makeTask("search.discover", {
        searchId: search.id,
        query: search.query ?? "",
        board,
        resumeId: search.resumeId ?? undefined,
        minScore: config.minScore,
        newJobsTarget: SEARCH_NEW_JOBS_TARGET,
        maxPages: SEARCH_MAX_PAGES,
      });
    }
    case "search.setup": {
      const resumeCount = await prisma.resume.count({ where: { userId } });
      return resumeCount > 0
        ? makeTask("search.setup", { minScore: config.minScore, trigger: "requested" })
        : null;
    }
    // Asked for by name, so they run off-schedule and past a paused feed.
    case "inbox.jobAlerts": {
      const alerts = await findJobAlerts(ctx, config);
      return alerts && makeTask("inbox.jobAlerts", alerts);
    }
    case "research.explore": {
      const research = await researchPayload(ctx, { config, trigger: "requested" });
      const { focus } = input.payload;
      return (
        research &&
        makeTask("research.explore", {
          ...research,
          newJobsTarget: SEARCH_NEW_JOBS_TARGET,
          ...(focus && { focus }),
        })
      );
    }
    case "resume.extract":
      return makeTask("resume.extract", input.payload);
    case "resume.tailor":
      return makeTask("resume.tailor", { requestId, ...input.payload });
    case "networking.find":
      return makeTask("networking.find", { requestId, ...input.payload });
    case "networking.rewrite":
      return makeTask("networking.rewrite", { requestId, ...input.payload });
    case "upwork.profile":
      return makeTask("upwork.profile", input.payload);
    case "upwork.proposal":
      return makeTask("upwork.proposal", input.payload);
    case "upwork.submit":
      return makeTask("upwork.submit", input.payload);
  }
}

/**
 * Pending requests as tasks, oldest first above everything but chat. One whose subject is gone
 * fails here, since no run will ever pick it up.
 */
export async function gatherRequests(
  ctx: GatherContext,
  pilot: RequestPilot,
): Promise<PilotTask[]> {
  const { prisma, userId, now } = ctx;
  const rows = await prisma.pilotRequest.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: REQUEST_BATCH,
  });
  const tasks: PilotTask[] = [];
  for (const row of rows) {
    const task = await requestTask({ ...ctx, ...pilot, requestId: row.id }, parseRequest(row));
    if (task) {
      // Fractions keep the oldest first without crossing into chat's priority.
      tasks.push({ ...task, priority: REQUEST_PRIORITY - tasks.length / 1000 });
      continue;
    }
    const [failed] = await prisma.pilotRequest.updateManyAndReturn({
      where: { id: row.id, status: "pending" },
      data: { status: "failed", finishedAt: now },
    });
    if (failed) {
      publishRequest(userId, failed, "request.updated");
    }
  }
  return tasks;
}

/** One reply to the newest user message that has none after it, so a burst gets one answer. */
export async function gatherChat(ctx: GatherContext): Promise<PilotTask | null> {
  const { prisma, userId } = ctx;
  const newest = await prisma.pilotMessage.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, author: true },
  });
  if (newest?.author !== "user") {
    return null;
  }
  return makeTask("chat.reply", { messageId: newest.id });
}
