import type { CreatePilotRequestInput, PilotTask } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import { publishRequest } from "../requests/request.service";
import { parseRequest } from "../requests/request-row";
import { applyTask } from "./build";
import { gatherInbox } from "./gather-inbox";
import { findApprovedJob } from "./gather-jobs";
import { makeTask, REQUEST_PRIORITY } from "./task-defs";

/** Requests waiting at once; more just wait a cycle. */
const REQUEST_BATCH = 20;
const SEARCH_NEW_JOBS_TARGET = 10;
const SEARCH_MAX_PAGES = 5;

interface RequestContext {
  prisma: PrismaClient;
  userId: string;
  requestId: string;
  minScore: number;
}

/** The task a request asks for, or null when its subject is gone and it can't run. */
async function requestTask(
  ctx: RequestContext,
  input: CreatePilotRequestInput,
): Promise<PilotTask | null> {
  const { prisma, userId, requestId } = ctx;
  switch (input.taskType) {
    case "job.apply": {
      const { campaignId, jobKey } = input.payload;
      const job = await findApprovedJob(prisma, userId, campaignId, jobKey);
      return job && applyTask(job, false);
    }
    case "job.rescanSkipped": {
      const { campaignId, jobKeys } = input.payload;
      const skippedCount =
        jobKeys?.length ??
        (await prisma.campaignJob.count({ where: { userId, campaignId, status: "skipped" } }));
      return makeTask("job.rescanSkipped", { campaignId, skippedCount, jobKeys });
    }
    case "job.retryFailed": {
      const { campaignId } = input.payload;
      const failedCount = await prisma.campaignJob.count({
        where: { userId, campaignId, status: "failed" },
      });
      return failedCount > 0 ? makeTask("job.retryFailed", { campaignId, failedCount }) : null;
    }
    case "inbox.review": {
      const { messageIds } = input.payload;
      const inbox = messageIds
        ? { messageIds, count: messageIds.length }
        : await gatherInbox(prisma, userId);
      return inbox.count > 0 ? makeTask("inbox.review", inbox) : null;
    }
    case "upwork.syncInbox":
      return makeTask("upwork.syncInbox", { lastSyncedAt: null, unreadCount: 0 });
    case "search.discover": {
      const search = await prisma.pilotSearch.findFirst({
        where: { id: input.payload.searchId, userId },
        select: {
          id: true,
          query: true,
          resumeId: true,
          board: { select: { domain: true } },
          campaigns: {
            where: { status: { in: ["in_progress", "paused"] } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!search) return null;
      return makeTask("search.discover", {
        searchId: search.id,
        query: search.query,
        board: search.board?.domain,
        resumeId: search.resumeId ?? undefined,
        campaignId: search.campaigns[0]?.id,
        minScore: ctx.minScore,
        newJobsTarget: SEARCH_NEW_JOBS_TARGET,
        maxPages: SEARCH_MAX_PAGES,
      });
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
  prisma: PrismaClient,
  userId: string,
  minScore: number,
  now: Date,
): Promise<PilotTask[]> {
  const rows = await prisma.pilotRequest.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: REQUEST_BATCH,
  });
  const tasks: PilotTask[] = [];
  for (const row of rows) {
    const task = await requestTask(
      { prisma, userId, requestId: row.id, minScore },
      parseRequest(row),
    );
    if (task) {
      // Fractions keep the oldest first without crossing into chat's priority.
      tasks.push({ ...task, priority: REQUEST_PRIORITY - tasks.length / 1000 });
      continue;
    }
    const [failed] = await prisma.pilotRequest.updateManyAndReturn({
      where: { id: row.id, status: "pending" },
      data: { status: "failed", finishedAt: now },
    });
    if (failed) publishRequest(userId, failed, "request.updated");
  }
  return tasks;
}

/** One reply to the newest user message that has none after it, so a burst gets one answer. */
export async function gatherChat(prisma: PrismaClient, userId: string): Promise<PilotTask | null> {
  const newest = await prisma.pilotMessage.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, author: true },
  });
  if (newest?.author !== "user") return null;
  return makeTask("chat.reply", { messageId: newest.id });
}
