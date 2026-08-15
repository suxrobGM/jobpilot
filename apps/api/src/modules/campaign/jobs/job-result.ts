import type { CampaignJobResultInput, CampaignJobStatus } from "@jobpilot/contracts/campaign";
import { CAMPAIGN_JOB_TERMINAL_OUTCOMES } from "@jobpilot/contracts/campaign";
import { conflict, findOwned } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";
import { canonicalizeJobUrl } from "@/modules/application/job-url";
import { normalizeCompanyName, normalizeJobTitle } from "@/modules/scoring/applied-duplicates";
import { toWireCampaignSource } from "../campaign.mapper";
import { deriveCampaignSummary } from "../campaign.summary";

/** Returns whether a job status is terminal. */
export function isTerminalJob(status: CampaignJobStatus): boolean {
  return CAMPAIGN_JOB_TERMINAL_OUTCOMES.includes(
    status as (typeof CAMPAIGN_JOB_TERMINAL_OUTCOMES)[number],
  );
}

function requireAppliedAt(data: CampaignJobResultInput): Date {
  if (data.outcome !== "applied" || !data.appliedAt) {
    throw new Error("Applied job result has no applied timestamp.");
  }
  return new Date(data.appliedAt);
}

/** Atomically records an idempotent terminal job result and its dependent writes. */
export async function writeJobResult(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
  key: string,
  data: CampaignJobResultInput,
) {
  const existing = await findOwned(
    (where) => prisma.job.findFirst({ where, include: { campaign: true } }),
    { campaignId, key, campaign: { userId } },
    "Campaign job",
  );
  if (isTerminalJob(existing.status)) {
    if (existing.status !== data.outcome) {
      throw conflict(`Job already finished with outcome ${existing.status}.`);
    }
    const application =
      data.outcome === "applied"
        ? await prisma.application.findUnique({
            where: { userId_url: { userId, url: canonicalizeJobUrl(existing.url) } },
          })
        : null;
    return {
      campaignJob: existing,
      application,
      summary: await deriveCampaignSummary(prisma, campaignId, existing.campaign.source),
      changed: false,
    };
  }

  return prisma.$transaction(async (tx) => {
    const changed = await tx.job.updateMany({
      where: { campaignId, key, status: { notIn: [...CAMPAIGN_JOB_TERMINAL_OUTCOMES] } },
      data: {
        status: data.outcome,
        appliedAt: data.outcome === "applied" ? requireAppliedAt(data) : null,
        failReason: data.outcome === "failed" ? data.failReason : null,
        skipReason: data.outcome === "skipped" ? data.skipReason : null,
        retryNotes: data.retryNotes,
        matchScore: data.matchScore,
      },
    });
    let raced = null;
    if (changed.count === 0) {
      raced = await tx.job.findUniqueOrThrow({ where: { campaignId_key: { campaignId, key } } });
      if (raced.status !== data.outcome) {
        throw conflict(`Job already finished with outcome ${raced.status}.`);
      }
    }
    const job =
      raced ?? (await tx.job.findUniqueOrThrow({ where: { campaignId_key: { campaignId, key } } }));
    const application =
      data.outcome === "applied"
        ? await tx.application.upsert({
            where: { userId_url: { userId, url: canonicalizeJobUrl(job.url) } },
            update: {},
            create: {
              userId,
              url: canonicalizeJobUrl(job.url),
              title: job.title,
              company: job.company,
              location: job.location,
              board: job.board,
              source: toWireCampaignSource(existing.campaign.source),
              campaignId,
              matchScore: job.matchScore,
              matchReason: job.matchReason,
              normalizedTitle: normalizeJobTitle(job.title),
              normalizedCompany: normalizeCompanyName(job.company),
              appliedAt: requireAppliedAt(data),
              events: {
                create: { kind: "status_change", toStatus: "applied", source: "campaign" },
              },
            },
          })
        : null;
    // tailor-resume runs before this row exists, so the variant cannot carry an applicationId at
    // creation - link it here by the url it recorded.
    if (application) {
      await tx.resumeVariant.updateMany({
        where: { jobUrl: job.url, applicationId: null, resume: { userId } },
        data: { applicationId: application.id },
      });
    }
    return {
      campaignJob: job,
      application,
      summary: await deriveCampaignSummary(tx, campaignId, existing.campaign.source),
      changed: changed.count > 0,
    };
  });
}
