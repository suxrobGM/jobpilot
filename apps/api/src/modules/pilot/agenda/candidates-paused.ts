import type { PrismaClient } from "@/generated/prisma/client";
import { parseCampaignConfig } from "@/modules/campaign/campaign.config";
import { MAX_PAUSED_REVIEWS, PAUSED_REVIEW_CANDIDATES, PAUSED_REVIEW_RETRY_MS } from "./constants";
import { claimDamped, latestClaimBySubject } from "./gather-jobs";
import type { AgendaPausedCampaign } from "./types";

/** Paused auto-apply campaigns nobody is working; every other campaign gather sees only `in_progress`. */
export async function gatherPausedCampaigns(
  prisma: PrismaClient,
  userId: string,
  now: Date,
  parkedBoards: string[],
): Promise<AgendaPausedCampaign[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { userId, status: "paused", source: "auto_apply" },
    orderBy: { updatedAt: "asc" }, // longest-paused first
    take: PAUSED_REVIEW_CANDIDATES,
    select: { campaignId: true, query: true, config: true, updatedAt: true },
  });
  if (campaigns.length === 0) return [];
  const ids = campaigns.map((c) => c.campaignId);

  const [questions, latest] = await Promise.all([
    prisma.pilotQuestion.findMany({
      where: {
        userId,
        subjectType: "campaign",
        subjectId: { in: ids },
        status: { in: ["open", "answered"] },
      },
      take: PAUSED_REVIEW_CANDIDATES,
      select: { subjectId: true, status: true, answeredAt: true },
    }),
    latestClaimBySubject(prisma, userId, "campaign.reviewPaused", ids),
  ]);

  const questionsByCampaign = new Map<string, typeof questions>();
  for (const q of questions) {
    if (q.subjectId == null) continue;
    const bucket = questionsByCampaign.get(q.subjectId);
    if (bucket) bucket.push(q);
    else questionsByCampaign.set(q.subjectId, [q]);
  }

  const parked = new Set(parkedBoards);
  const out: AgendaPausedCampaign[] = [];

  for (const c of campaigns) {
    if (out.length === MAX_PAUSED_REVIEWS) break;

    const board = parseCampaignConfig(c.config).board ?? null;
    // A campaign targeting a parked board stays parked until the user un-parks it.
    if (board && parked.has(board)) continue;

    // An answer newer than the pause decided THIS pause episode; an older one is a previous episode.
    const decided = (questionsByCampaign.get(c.campaignId) ?? []).some(
      (q) => q.status === "open" || (q.answeredAt != null && q.answeredAt > c.updatedAt),
    );
    if (decided) continue;

    if (claimDamped(latest.get(c.campaignId), now, PAUSED_REVIEW_RETRY_MS)) continue;

    out.push({ campaignId: c.campaignId, query: c.query, board, pausedAt: c.updatedAt });
  }
  return out;
}
