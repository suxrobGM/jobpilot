import { CAMPAIGN_JOB_TERMINAL_OUTCOMES } from "@jobpilot/contracts/campaign";
import { singleton } from "tsyringe";
import { PrismaClient } from "@/generated/prisma/client";
import type { PipelineStage } from "./pipeline.constants";
import {
  toApplication,
  toCampaignJob,
  toQueueEntry,
  type PipelineColumnPage,
  type PipelineJobDto,
} from "./pipeline.mapper";

/** Active board/campaign/search scoping applied to a pipeline column query. */
export interface PipelineFilters {
  search?: string | null;
  board?: string | null;
  campaignId?: string | null;
}

type ApplicationStageFilter = string | { notIn: string[] };

function withCursor(cursor: number | null) {
  return cursor ? { id: { lt: cursor } } : {};
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function emptyPage(stage: PipelineStage): PipelineColumnPage {
  return { stage, items: [], nextCursor: null, total: 0, todayCount: 0 };
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

@singleton()
export class PipelineService {
  constructor(private readonly prisma: PrismaClient) {}

  loadStage(
    profileId: number,
    stage: PipelineStage,
    cursor: number | null,
    limit: number,
    filters: PipelineFilters,
  ): Promise<PipelineColumnPage> {
    switch (stage) {
      case "queued":
        return this.loadQueued(profileId, cursor, limit, filters);
      case "applying":
        return this.loadApplying(profileId, cursor, limit, filters);
      case "submitted":
        return this.loadSubmitted(profileId, cursor, limit, filters);
      case "interviewing":
        return this.loadInterviewing(profileId, cursor, limit, filters);
    }
  }

  async loadQueued(
    profileId: number,
    cursor: number | null,
    limit: number,
    filters: PipelineFilters,
  ): Promise<PipelineColumnPage> {
    // Queued entries live in QueueEntry, which has no campaignId — a campaign scope can
    // never match them, so short-circuit (mirrors the board handling).
    if (filters.board || filters.campaignId) {
      return emptyPage("queued");
    }

    const baseWhere = { profileId, status: "pending" } as const;
    const searchWhere = filters.search
      ? {
          OR: [{ url: { contains: filters.search } }, { note: { contains: filters.search } }],
        }
      : {};

    const [items, total, todayCount] = await Promise.all([
      this.prisma.queueEntry.findMany({
        where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
        orderBy: { id: "desc" },
        take: limit + 1,
      }),
      this.prisma.queueEntry.count({ where: baseWhere }),
      this.prisma.queueEntry.count({
        where: { ...baseWhere, createdAt: { gte: startOfToday() } },
      }),
    ]);

    return finalize("queued", items, total, todayCount, limit, toQueueEntry);
  }

  async loadApplying(
    profileId: number,
    cursor: number | null,
    limit: number,
    filters: PipelineFilters,
  ): Promise<PipelineColumnPage> {
    const baseWhere = {
      campaign: { status: "in_progress", profileId },
      status: { notIn: [...CAMPAIGN_JOB_TERMINAL_OUTCOMES] },
      ...(filters.board ? { board: filters.board } : {}),
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    };
    const searchWhere = filters.search
      ? {
          OR: [{ title: { contains: filters.search } }, { company: { contains: filters.search } }],
        }
      : {};

    const [items, total, todayCount] = await Promise.all([
      this.prisma.job.findMany({
        where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
        orderBy: { id: "desc" },
        take: limit + 1,
      }),
      this.prisma.job.count({ where: baseWhere }),
      this.prisma.job.count({ where: { ...baseWhere, appliedAt: { gte: startOfToday() } } }),
    ]);

    return finalize("applying", items, total, todayCount, limit, toCampaignJob);
  }

  loadSubmitted(
    profileId: number,
    cursor: number | null,
    limit: number,
    filters: PipelineFilters,
  ): Promise<PipelineColumnPage> {
    return this.loadApplicationStage(profileId, "submitted", "applied", cursor, limit, filters, {
      extraSearchFields: ["url"],
    });
  }

  loadInterviewing(
    profileId: number,
    cursor: number | null,
    limit: number,
    filters: PipelineFilters,
  ): Promise<PipelineColumnPage> {
    return this.loadApplicationStage(
      profileId,
      "interviewing",
      { notIn: ["applied", "rejected", "withdrawn"] },
      cursor,
      limit,
      filters,
    );
  }

  private async loadApplicationStage(
    profileId: number,
    stage: PipelineStage,
    stageFilter: ApplicationStageFilter,
    cursor: number | null,
    limit: number,
    filters: PipelineFilters,
    opts: { extraSearchFields?: "url"[] } = {},
  ): Promise<PipelineColumnPage> {
    const baseWhere = {
      profileId,
      stage: stageFilter,
      ...(filters.board ? { board: filters.board } : {}),
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
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
      this.prisma.application.findMany({
        where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
        orderBy: { id: "desc" },
        take: limit + 1,
      }),
      this.prisma.application.count({ where: baseWhere }),
      this.prisma.application.count({
        where: { ...baseWhere, appliedAt: { gte: startOfToday() } },
      }),
    ]);

    return finalize(stage, items, total, todayCount, limit, (a) => toApplication(a, stage));
  }
}
