import type { CampaignJobResultInput, CampaignJobStatus } from "@jobpilot/contracts/campaign";
import { CAMPAIGN_JOB_TERMINAL_OUTCOMES } from "@jobpilot/contracts/campaign";
import { conflict, findOwned } from "@/common/errors";
import type { Application, PrismaClient } from "@/generated/prisma/client";
import { canonicalizeJobUrl } from "@/modules/application/job-url";
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

interface SubmittedResume {
  resumeId: string | null;
  resumeVariantId: string | null;
}

/**
 * Resolves the resume the agent says it submitted, dropping anything the user doesn't own - the ids
 * arrive from the agent, not from a route the auth guard has already scoped. A variant's own
 * `resumeId` wins over a reported one so the two can never disagree.
 */
async function resolveSubmittedResume(
  tx: Pick<PrismaClient, "resume" | "resumeVariant">,
  userId: string,
  data: CampaignJobResultInput,
): Promise<SubmittedResume> {
  if (data.resumeVariantId) {
    const variant = await tx.resumeVariant.findFirst({
      where: { id: data.resumeVariantId, resume: { userId } },
      select: { id: true, resumeId: true },
    });
    if (variant) return { resumeId: variant.resumeId, resumeVariantId: variant.id };
  }
  if (data.resumeId) {
    const resume = await tx.resume.findFirst({
      where: { id: data.resumeId, userId },
      select: { id: true },
    });
    if (resume) return { resumeId: resume.id, resumeVariantId: null };
  }
  return { resumeId: null, resumeVariantId: null };
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

    const canonicalUrl = canonicalizeJobUrl(job.url);

    let application: Application | null = null;
    if (data.outcome === "applied") {
      const appliedAt = requireAppliedAt(data);
      const logApplied = {
        create: { kind: "status_change", toStatus: "applied", source: "campaign" },
      } as const;
      const submitted = await resolveSubmittedResume(tx, userId, data);

      application = await tx.application.upsert({
        where: { userId_url: { userId, url: canonicalUrl } },
        // A repost reuses this row, so the date has to move: the duplicate window measures from
        // it, and a frozen date retires the guard for that url. A result already recorded
        // (`count === 0`) must not, or the retry logs a second event.
        update: changed.count === 0 ? {} : { appliedAt, events: logApplied, ...submitted },
        create: {
          userId,
          url: canonicalUrl,
          title: job.title,
          company: job.company,
          location: job.location,
          board: job.board,
          source: toWireCampaignSource(existing.campaign.source),
          campaignId,
          matchScore: job.matchScore,
          matchReason: job.matchReason,
          appliedAt,
          events: logApplied,
          ...submitted,
        },
      });

      // Marks the variant used, which is what the resume page's prune filter reads. A reused variant
      // already points at the application it was created for; that first link is the one to keep.
      if (submitted.resumeVariantId) {
        await tx.resumeVariant.updateMany({
          where: { id: submitted.resumeVariantId, applicationId: null },
          data: { applicationId: application.id },
        });
      }
    }

    // The letter is written before this row exists, so link it by the url it recorded.
    if (application) {
      await tx.coverLetter.updateMany({
        where: { jobUrl: job.url, applicationId: null, userId },
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
