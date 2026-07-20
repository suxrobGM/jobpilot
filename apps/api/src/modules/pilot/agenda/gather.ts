// The agenda inputs outside the job pipeline: consumable answers, campaigns ready to close, and
// unclassified mail. The apply/discovery gathers live in gather-jobs.ts.

import { CAMPAIGN_JOB_ACTIVE_STATUSES } from "@jobpilot/contracts/campaign";
import type { PrismaClient } from "@/generated/prisma/client";
import { GATHER_CAP } from "./constants";
import type { AgendaFinalizeCampaign, AgendaInbox, AgendaQuestion } from "./types";

/** Answered questions not yet consumed by any lease, so a claimed answer never re-appears. */
export async function gatherAnsweredQuestions(
  prisma: PrismaClient,
  userId: string,
): Promise<AgendaQuestion[]> {
  const answered = await prisma.question.findMany({
    where: { userId, status: "answered" },
    // Newest first: consumed rows stay "answered" forever, so oldest-first would starve new answers.
    orderBy: { answeredAt: "desc" },
    take: GATHER_CAP,
    select: {
      id: true,
      kind: true,
      prompt: true,
      subjectType: true,
      subjectId: true,
      answer: true,
    },
  });
  if (answered.length === 0) return [];
  // Only the answered ids can be consumed, so scope the lease lookup to them.
  const leases = await prisma.pilotLease.findMany({
    where: {
      userId,
      subjectType: "question",
      subjectId: { in: answered.map((e) => e.id) },
      // An expired/abandoned lease hands the answer back; active or completed leases consume it.
      OR: [
        { releasedAt: null },
        { releasedAt: { not: null }, outcome: { notIn: ["expired", "abandoned"] } },
      ],
    },
    take: GATHER_CAP,
    select: { subjectId: true },
  });
  const consumed = new Set(leases.map((l) => l.subjectId));
  return answered
    .filter((e) => !consumed.has(e.id))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      prompt: e.prompt,
      subjectType: e.subjectType,
      subjectId: e.subjectId,
      answer: e.answer,
    }));
}

/** In-progress campaigns with no active jobs left - ready to finalize. */
export function gatherFinalizeCampaigns(
  prisma: PrismaClient,
  userId: string,
): Promise<AgendaFinalizeCampaign[]> {
  return prisma.campaign.findMany({
    where: {
      userId,
      status: "in_progress",
      jobs: { none: { status: { in: [...CAMPAIGN_JOB_ACTIVE_STATUSES] } } },
    },
    select: { campaignId: true, query: true },
  });
}

/** Oldest-first ids (≤10) plus total count of unclassified synced mail - the scan-inbox predicate. */
export async function gatherInbox(prisma: PrismaClient, userId: string): Promise<AgendaInbox> {
  const where = { account: { userId }, classification: null, reviewStatus: "pending" } as const;
  const [rows, count] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      take: 10,
      select: { id: true },
    }),
    prisma.emailMessage.count({ where }),
  ]);
  return { messageIds: rows.map((r) => r.id), count };
}
