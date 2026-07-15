import type {
  ApplicationEventKind,
  ApplicationEventSource,
  ApplicationSource,
  ApplicationStatus,
  StatusTransitionInput,
} from "@jobpilot/contracts/application";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  APPLIED_DUPLICATE_WINDOW_DAYS,
  findFuzzyDuplicate,
} from "@/modules/scoring/applied-duplicates";
import { statusChangeOps } from "./status-change";

export interface AppliedListFilters {
  status?: ApplicationStatus;
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

  async list(profileId: string, filters: AppliedListFilters) {
    const { status, board, source, search } = filters;

    const where: Prisma.ApplicationWhereInput = { profileId };

    if (status) {
      where.status = status;
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
      source: r.source as ApplicationSource,
      appliedAt: r.appliedAt,
      rejectedAt: r.rejectedAt,
    }));
  }

  async get(profileId: string, id: string) {
    const row = await findOwned(
      (where) =>
        this.prisma.application.findFirst({
          where,
          include: {
            events: { orderBy: { createdAt: "asc" } },
          },
        }),
      { id, profileId },
      "Application",
    );

    return {
      ...row,
      source: row.source as ApplicationSource,
      appliedAt: row.appliedAt,
      rejectedAt: row.rejectedAt,
      events: row.events.map((e) => ({
        ...e,
        kind: e.kind as ApplicationEventKind,
        source: e.source as ApplicationEventSource | null,
      })),
    };
  }

  async addEvent(profileId: string, id: string, input: { kind: "note"; notes: string }) {
    await findOwned(
      (where) => this.prisma.application.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Application",
    );
    const event = await this.prisma.applicationEvent.create({
      data: { applicationId: id, kind: input.kind, note: input.notes },
    });
    return {
      ...event,
      kind: event.kind as ApplicationEventKind,
      source: event.source as ApplicationEventSource | null,
    };
  }

  async remove(profileId: string, id: string) {
    await findOwned(
      (where) => this.prisma.application.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Application",
    );
    await this.prisma.application.delete({ where: { id } });
    return { deleted: id };
  }

  async transitionStatus(profileId: string, id: string, input: StatusTransitionInput) {
    const existing = await findOwned(
      (where) => this.prisma.application.findFirst({ where }),
      { id, profileId },
      "Application",
    );

    const fromStatus = existing.status;
    const toStatus = input.toStatus;

    if (fromStatus === toStatus) {
      return { id, status: toStatus, unchanged: true };
    }

    await this.prisma.$transaction(
      statusChangeOps(this.prisma, {
        applicationId: id,
        fromStatus,
        toStatus,
        source: "manual",
        note: input.note,
      }),
    );

    return { id, status: toStatus };
  }

  async check(profileId: string, query: AppliedCheckQuery) {
    const targetUrl = query.url;
    const title = query.title;
    const company = query.company;

    if (targetUrl) {
      const exact = await this.prisma.application.findUnique({
        where: { profileId_url: { profileId, url: targetUrl } },
      });
      if (exact) {
        return {
          applied: true as const,
          match: {
            kind: "url" as const,
            application: {
              id: exact.id,
              url: exact.url,
              title: exact.title,
              company: exact.company,
              appliedAt: exact.appliedAt,
              status: exact.status,
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
          status: true,
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
          applied: true as const,
          match: {
            kind: "fuzzy" as const,
            score: fuzzy.score,
            application: {
              id: matched.id,
              url: matched.url,
              title: matched.title,
              company: matched.company,
              appliedAt: matched.appliedAt,
              status: matched.status,
            },
          },
        };
      }
    }

    return { applied: false as const, match: null };
  }
}
