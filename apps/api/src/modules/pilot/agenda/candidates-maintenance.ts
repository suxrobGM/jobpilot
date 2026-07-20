import { z } from "zod/v4";
import { DAY_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { parseCampaignConfig } from "@/modules/campaign/campaign.config";
import { isJobSummary } from "@/modules/campaign/campaign.mapper";
import { loadCampaignSummaries } from "@/modules/campaign/campaign.summary";
import type { AgendaRescanSkipped, AgendaRetryFailed, AgendaStrategyReview } from "./types";

const STRATEGY_MIN_JOBS = 20;
const STRATEGY_MAX_RATIO = 0.2;
const RESCAN_MIN_SKIPPED = 5;
const RETRY_MIN_FAILED = 3;
const TOP_REASON_LIMIT = 3;

function markedSubjects(
  markers: { subjectId: string | null; detail: unknown }[],
  type: string,
): Set<string> {
  const ids = new Set<string>();
  for (const marker of markers) {
    if (!marker.subjectId) continue;
    const detail = z.object({ type: z.string().optional() }).loose().parse(marker.detail);
    if (detail.type === type) ids.add(marker.subjectId);
  }
  return ids;
}

async function topSkipReasonsByCampaign(
  prisma: PrismaClient,
  campaignIds: string[],
): Promise<Map<string, string[]>> {
  if (campaignIds.length === 0) return new Map();
  const rows = await prisma.job.groupBy({
    by: ["campaignId", "skipReason"],
    where: { campaignId: { in: campaignIds }, status: "skipped", skipReason: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { skipReason: "desc" } },
  });
  const reasonsByCampaign = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.skipReason) continue;
    const reasons = reasonsByCampaign.get(row.campaignId) ?? [];
    if (reasons.length < TOP_REASON_LIMIT) {
      reasons.push(row.skipReason);
      reasonsByCampaign.set(row.campaignId, reasons);
    }
  }
  return reasonsByCampaign;
}

/** Finds deduplicated strategy-review, rescan, and retry work for a quiet agenda. */
export async function gatherQuietCandidates(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<{
  strategyReviews: AgendaStrategyReview[];
  rescanSkipped: AgendaRescanSkipped[];
  retryFailed: AgendaRetryFailed[];
}> {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const [campaigns, markers] = await Promise.all([
    prisma.campaign.findMany({
      where: { userId, status: "in_progress", source: { not: "networking" } },
      select: { campaignId: true, query: true, config: true, source: true },
    }),
    prisma.pilotJournalEntry.findMany({
      where: { userId, kind: "action", createdAt: { gte: since } },
      select: { subjectId: true, detail: true },
    }),
  ]);
  const summaries = await loadCampaignSummaries(prisma, campaigns);
  const strategyMarked = markedSubjects(markers, "strategyReview");
  const rescanMarked = markedSubjects(markers, "rescanSkipped");
  const retryMarked = markedSubjects(markers, "retryFailed");
  const strategyReviews: AgendaStrategyReview[] = [];
  const rescanSkipped: AgendaRescanSkipped[] = [];
  const retryFailed: AgendaRetryFailed[] = [];

  for (const campaign of campaigns) {
    const summary = summaries.get(campaign.campaignId);
    if (!summary || !isJobSummary(summary)) continue;
    if (
      summary.totalFound >= STRATEGY_MIN_JOBS &&
      summary.qualified / summary.totalFound < STRATEGY_MAX_RATIO &&
      !strategyMarked.has(campaign.campaignId)
    ) {
      const config = parseCampaignConfig(campaign.config);
      strategyReviews.push({
        campaignId: campaign.campaignId,
        query: campaign.query,
        minScore: config.minScore ?? null,
        board: config.board ?? null,
        counts: {
          totalFound: summary.totalFound,
          qualified: summary.qualified,
          applied: summary.applied,
          skipped: summary.skipped,
        },
        topSkipReasons: [],
      });
    }
    if (summary.skipped >= RESCAN_MIN_SKIPPED && !rescanMarked.has(campaign.campaignId)) {
      rescanSkipped.push({ campaignId: campaign.campaignId, skippedCount: summary.skipped });
    }
    if (summary.failed >= RETRY_MIN_FAILED && !retryMarked.has(campaign.campaignId)) {
      retryFailed.push({ campaignId: campaign.campaignId, failedCount: summary.failed });
    }
  }

  const skipReasons = await topSkipReasonsByCampaign(
    prisma,
    strategyReviews.map((candidate) => candidate.campaignId),
  );
  for (const candidate of strategyReviews) {
    candidate.topSkipReasons = skipReasons.get(candidate.campaignId) ?? [];
  }
  return { strategyReviews, rescanSkipped, retryFailed };
}
