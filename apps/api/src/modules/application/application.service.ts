import type {
  ApplicationSource,
  Stage,
  StageTransitionInput,
} from "@jobpilot/contracts/application";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  APPLIED_DUPLICATE_WINDOW_DAYS,
  findFuzzyDuplicate,
} from "@/modules/scoring/applied-duplicates";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

/** Stages that count as a positive recruiter/interview response. */
const POSITIVE_STAGES = new Set([
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
]);

export interface AppliedListFilters {
  stage?: string;
  board?: string;
  source?: string;
  search?: string;
}

export interface AppliedCheckQuery {
  url?: string;
  title?: string;
  company?: string;
}

@singleton()
export class ApplicationService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(profileId: number, filters: AppliedListFilters) {
    const { stage, board, source, search } = filters;

    const where: Prisma.ApplicationWhereInput = { profileId };

    if (stage) {
      where.stage = stage;
    }
    if (board) {
      where.board = board;
    }
    if (source) {
      where.source = source;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { company: { contains: search } },
        { url: { contains: search } },
      ];
    }

    const rows = await this.prisma.application.findMany({
      where,
      orderBy: { appliedAt: "desc" },
      take: 500,
    });

    return rows.map((r) => ({
      ...r,
      stage: r.stage as Stage,
      source: r.source as ApplicationSource,
    }));
  }

  async get(profileId: number, id: number) {
    const row = await findOwned(
      (where) =>
        this.prisma.application.findFirst({
          where,
          include: {
            stageEvents: { orderBy: { occurredAt: "asc" } },
          },
        }),
      { id, profileId },
      "Application",
    );

    return {
      ...row,
      stage: row.stage as Stage,
      source: row.source as ApplicationSource,
    };
  }

  async remove(profileId: number, id: number) {
    await findOwned(
      (where) => this.prisma.application.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Application",
    );
    await this.prisma.application.delete({ where: { id } });
    return { deleted: id };
  }

  async transitionStage(profileId: number, id: number, input: StageTransitionInput) {
    const existing = await findOwned(
      (where) => this.prisma.application.findFirst({ where }),
      { id, profileId },
      "Application",
    );

    const fromStage = existing.stage;
    const toStage = input.toStage;

    if (fromStage === toStage) {
      return { id, stage: toStage, unchanged: true };
    }

    const outcome =
      toStage === "rejected" ? "negative" : POSITIVE_STAGES.has(toStage) ? "positive" : null;
    const rejectedAt = toStage === "rejected" ? new Date() : null;

    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id },
        data: { stage: toStage, outcome, rejectedAt },
      }),
      this.prisma.stageEvent.create({
        data: {
          applicationId: id,
          fromStage,
          toStage,
          note: input.note ?? null,
        },
      }),
    ]);

    return { id, stage: toStage };
  }

  async check(profileId: number, query: AppliedCheckQuery) {
    const targetUrl = query.url;
    const title = query.title;
    const company = query.company;

    if (targetUrl) {
      const exact = await this.prisma.application.findUnique({
        where: { profileId_url: { profileId, url: targetUrl } },
      });
      if (exact) {
        return {
          applied: true,
          match: {
            kind: "url",
            application: {
              id: exact.id,
              url: exact.url,
              title: exact.title,
              company: exact.company,
              appliedAt: exact.appliedAt.toISOString(),
              stage: exact.stage as Stage,
            },
          },
        };
      }
    }

    if (title && company) {
      const cutoff = new Date(Date.now() - APPLIED_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const candidates = await this.prisma.application.findMany({
        where: { profileId, appliedAt: { gte: cutoff } },
        select: {
          id: true,
          url: true,
          title: true,
          company: true,
          appliedAt: true,
          stage: true,
        },
        take: 1000,
      });

      const fuzzy = findFuzzyDuplicate(
        { title, company },
        candidates.map((c) => ({
          id: c.id,
          url: c.url,
          title: c.title,
          company: c.company,
          appliedAt: c.appliedAt,
        })),
        APPLIED_DUPLICATE_THRESHOLD,
      );

      if (fuzzy) {
        const matched = candidates.find((c) => c.id === fuzzy.candidate.id)!;
        return {
          applied: true,
          match: {
            kind: "fuzzy",
            score: fuzzy.score,
            application: {
              id: matched.id,
              url: matched.url,
              title: matched.title,
              company: matched.company,
              appliedAt: matched.appliedAt.toISOString(),
              stage: matched.stage as Stage,
            },
          },
        };
      }
    }

    return { applied: false, match: null };
  }
}
