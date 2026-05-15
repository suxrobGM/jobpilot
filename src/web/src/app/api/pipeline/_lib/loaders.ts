import { db } from "@/lib/db";
import type { PipelineColumnPage, PipelineJobDto, PipelineStage } from "@/types/api/pipeline";
import { mapApplication, mapQueueEntry, mapRunJob } from "./mappers";
import type { PipelineFilters } from "./params";

export function emptyPage(stage: PipelineStage): PipelineColumnPage {
  return { stage, items: [], nextCursor: null, total: 0, todayCount: 0 };
}

export async function loadQueued(
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  if (filters.board || filters.matchMin != null) {
    return emptyPage("queued");
  }

  const baseWhere = { status: "pending" } as const;
  const searchWhere = filters.search
    ? {
        OR: [{ url: { contains: filters.search } }, { note: { contains: filters.search } }],
      }
    : {};

  const [items, total, todayCount] = await Promise.all([
    db.queueEntry.findMany({
      where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.queueEntry.count({ where: baseWhere }),
    db.queueEntry.count({ where: { ...baseWhere, createdAt: { gte: startOfToday() } } }),
  ]);

  return finalize("queued", items, total, todayCount, limit, mapQueueEntry);
}

export async function loadApplying(
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  const baseWhere = {
    run: { status: "in_progress" },
    status: { notIn: ["applied", "failed", "skipped"] },
    ...(filters.board ? { board: filters.board } : {}),
    ...(filters.matchMin != null ? { matchScore: { gte: filters.matchMin } } : {}),
  };
  const searchWhere = filters.search
    ? {
        OR: [
          { title: { contains: filters.search } },
          { company: { contains: filters.search } },
        ],
      }
    : {};

  const [items, total, todayCount] = await Promise.all([
    db.runJob.findMany({
      where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.runJob.count({ where: baseWhere }),
    db.runJob.count({ where: { ...baseWhere, appliedAt: { gte: startOfToday() } } }),
  ]);

  return finalize("applying", items, total, todayCount, limit, mapRunJob);
}

export function loadSubmitted(
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  return loadApplicationStage("submitted", "applied", cursor, limit, filters, {
    extraSearchFields: ["url"],
  });
}

export function loadReplied(
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  return loadApplicationStage(
    "replied",
    { notIn: ["applied", "rejected", "withdrawn"] },
    cursor,
    limit,
    filters,
  );
}

type ApplicationStageFilter = string | { notIn: string[] };

async function loadApplicationStage(
  stage: PipelineStage,
  stageFilter: ApplicationStageFilter,
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
  opts: { extraSearchFields?: ("url")[] } = {},
): Promise<PipelineColumnPage> {
  const baseWhere = {
    stage: stageFilter,
    ...(filters.board ? { board: filters.board } : {}),
    ...(filters.matchMin != null ? { matchScore: { gte: filters.matchMin } } : {}),
  };
  const searchWhere = filters.search
    ? {
        OR: [
          { title: { contains: filters.search } },
          { company: { contains: filters.search } },
          ...(opts.extraSearchFields?.includes("url")
            ? [{ url: { contains: filters.search } }]
            : []),
        ],
      }
    : {};

  const [items, total, todayCount] = await Promise.all([
    db.application.findMany({
      where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.application.count({ where: baseWhere }),
    db.application.count({ where: { ...baseWhere, appliedAt: { gte: startOfToday() } } }),
  ]);

  return finalize(stage, items, total, todayCount, limit, (a) => mapApplication(a, stage));
}

function withCursor(cursor: number | null) {
  return cursor ? { id: { lt: cursor } } : {};
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function finalize<T extends { id: number }>(
  stage: PipelineStage,
  items: T[],
  total: number,
  todayCount: number,
  limit: number,
  map: (item: T) => PipelineJobDto,
): PipelineColumnPage {
  const hasNext = items.length > limit;
  const page = hasNext ? items.slice(0, limit) : items;
  return {
    stage,
    items: page.map(map),
    nextCursor: hasNext ? String(page[page.length - 1]!.id) : null,
    total,
    todayCount,
  };
}
