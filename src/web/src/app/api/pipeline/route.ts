import type { Application, QueueEntry, RunJob } from "@/generated/prisma/client";
import { err, ErrorCodes, ok } from "@/lib/api";
import { parseQueryParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import {
  PIPELINE_STAGES,
  type PipelineColumnPage,
  type PipelineJobDto,
  type PipelineStage,
} from "@/types/api/pipeline";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface PipelineFilters {
  search?: string;
  board?: string;
  matchMin?: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseCursor(cursor: string | null): number | null {
  if (!cursor) return null;
  const n = Number.parseInt(cursor, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeString(value: string | null): string | undefined {
  const v = value?.trim();
  return v && v.length > 0 ? v : undefined;
}

function safeMatchMin(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return undefined;
  return Math.min(n, 100);
}

function isPipelineStage(value: string | null): value is PipelineStage {
  return value !== null && (PIPELINE_STAGES as readonly string[]).includes(value);
}

function mapQueueEntry(entry: QueueEntry): PipelineJobDto {
  return {
    id: `queue:${entry.id}`,
    stage: "queued",
    role: entry.note ?? "Pending application",
    company: "—",
    location: null,
    board: null,
    matchScore: null,
    resumeVariant: null,
    updatedAt: entry.createdAt.toISOString(),
    liveStep: null,
    liveMessage: null,
    replySummary: null,
    url: entry.url,
    runId: null,
    applicationId: null,
  };
}

function mapRunJob(job: RunJob): PipelineJobDto {
  return {
    id: `run:${job.runId}:${job.jobKey}`,
    stage: "applying",
    role: job.title,
    company: job.company,
    location: job.location,
    board: job.board,
    matchScore: job.matchScore,
    resumeVariant: null,
    updatedAt: (job.appliedAt ?? new Date()).toISOString(),
    liveStep: job.status,
    liveMessage: job.retryNotes,
    replySummary: null,
    url: job.url,
    runId: job.runId,
    applicationId: null,
  };
}

function mapApplication(app: Application, stage: PipelineStage): PipelineJobDto {
  const replySummary =
    stage === "replied"
      ? app.outcome ?? `Stage: ${app.stage}`
      : null;
  return {
    id: `app:${app.id}`,
    stage,
    role: app.title,
    company: app.company,
    location: app.location,
    board: app.board,
    matchScore: app.matchScore,
    resumeVariant: null,
    updatedAt: app.appliedAt.toISOString(),
    liveStep: null,
    liveMessage: null,
    replySummary,
    url: app.url,
    runId: app.runId,
    applicationId: app.id,
  };
}

async function loadQueued(
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  if (filters.board || filters.matchMin !== undefined) {
    return emptyPage("queued");
  }

  const baseWhere = { status: "pending" } as const;
  const where = {
    ...baseWhere,
    ...(cursor ? { id: { lt: cursor } } : {}),
    ...(filters.search
      ? {
          OR: [{ url: { contains: filters.search } }, { note: { contains: filters.search } }],
        }
      : {}),
  };

  const [items, total, todayCount] = await Promise.all([
    db.queueEntry.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.queueEntry.count({ where: baseWhere }),
    db.queueEntry.count({
      where: { ...baseWhere, createdAt: { gte: startOfToday() } },
    }),
  ]);

  const hasNext = items.length > limit;
  const page = hasNext ? items.slice(0, limit) : items;
  return {
    stage: "queued",
    items: page.map(mapQueueEntry),
    nextCursor: hasNext ? String(page[page.length - 1]!.id) : null,
    total,
    todayCount,
  };
}

async function loadApplying(
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  const baseWhere = {
    run: { status: "in_progress" },
    status: { notIn: ["applied", "failed", "skipped"] },
    ...(filters.board ? { board: filters.board } : {}),
    ...(filters.matchMin !== undefined ? { matchScore: { gte: filters.matchMin } } : {}),
  };

  const where = {
    ...baseWhere,
    ...(cursor ? { id: { lt: cursor } } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search } },
            { company: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [items, total, todayCount] = await Promise.all([
    db.runJob.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.runJob.count({ where: baseWhere }),
    db.runJob.count({
      where: { ...baseWhere, appliedAt: { gte: startOfToday() } },
    }),
  ]);

  const hasNext = items.length > limit;
  const page = hasNext ? items.slice(0, limit) : items;
  return {
    stage: "applying",
    items: page.map(mapRunJob),
    nextCursor: hasNext ? String(page[page.length - 1]!.id) : null,
    total,
    todayCount,
  };
}

async function loadSubmitted(
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  const baseWhere = {
    stage: "applied",
    ...(filters.board ? { board: filters.board } : {}),
    ...(filters.matchMin !== undefined ? { matchScore: { gte: filters.matchMin } } : {}),
  } as const;
  const where = {
    ...baseWhere,
    ...(cursor ? { id: { lt: cursor } } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search } },
            { company: { contains: filters.search } },
            { url: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [items, total, todayCount] = await Promise.all([
    db.application.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.application.count({ where: baseWhere }),
    db.application.count({
      where: { ...baseWhere, appliedAt: { gte: startOfToday() } },
    }),
  ]);

  const hasNext = items.length > limit;
  const page = hasNext ? items.slice(0, limit) : items;
  return {
    stage: "submitted",
    items: page.map((a) => mapApplication(a, "submitted")),
    nextCursor: hasNext ? String(page[page.length - 1]!.id) : null,
    total,
    todayCount,
  };
}

async function loadReplied(
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  const baseWhere = {
    stage: { notIn: ["applied", "rejected", "withdrawn"] },
    ...(filters.board ? { board: filters.board } : {}),
    ...(filters.matchMin !== undefined ? { matchScore: { gte: filters.matchMin } } : {}),
  };

  const where = {
    ...baseWhere,
    ...(cursor ? { id: { lt: cursor } } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search } },
            { company: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [items, total, todayCount] = await Promise.all([
    db.application.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.application.count({ where: baseWhere }),
    db.application.count({
      where: { ...baseWhere, appliedAt: { gte: startOfToday() } },
    }),
  ]);

  const hasNext = items.length > limit;
  const page = hasNext ? items.slice(0, limit) : items;
  return {
    stage: "replied",
    items: page.map((a) => mapApplication(a, "replied")),
    nextCursor: hasNext ? String(page[page.length - 1]!.id) : null,
    total,
    todayCount,
  };
}

function emptyPage(stage: PipelineStage): PipelineColumnPage {
  return { stage, items: [], nextCursor: null, total: 0, todayCount: 0 };
}

export async function GET(req: Request) {
  const {
    stage,
    cursor: cursorRaw,
    limit: limitParam,
    search: searchRaw,
    board: boardRaw,
    matchMin: matchMinRaw,
  } = parseQueryParams(req, [
    "stage",
    "cursor",
    "limit",
    "search",
    "board",
    "matchMin",
  ] as const);

  if (!isPipelineStage(stage)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid or missing 'stage' parameter", 400);
  }

  const cursor = parseCursor(cursorRaw);
  const limitRaw = Number.parseInt(limitParam ?? "", 10);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const filters: PipelineFilters = {
    search: safeString(searchRaw),
    board: safeString(boardRaw),
    matchMin: safeMatchMin(matchMinRaw),
  };

  switch (stage) {
    case "discovered":
      return ok(emptyPage("discovered"));
    case "queued":
      return ok(await loadQueued(cursor, limit, filters));
    case "applying":
      return ok(await loadApplying(cursor, limit, filters));
    case "submitted":
      return ok(await loadSubmitted(cursor, limit, filters));
    case "replied":
      return ok(await loadReplied(cursor, limit, filters));
  }
}
