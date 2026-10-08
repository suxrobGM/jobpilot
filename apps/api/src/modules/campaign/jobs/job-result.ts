import type { CampaignJobResultInput, CampaignJobStatus } from "@jobpilot/contracts/campaign";
import { CAMPAIGN_JOB_TERMINAL_OUTCOMES } from "@jobpilot/contracts/campaign";
import { conflict, findOwned } from "@/common/errors";
import type { Application, PrismaClient } from "@/generated/prisma/client";
import { canonicalizeJobUrl } from "@/modules/application/job-url";

export function isTerminalJob(status: CampaignJobStatus): boolean {
  return (CAMPAIGN_JOB_TERMINAL_OUTCOMES as readonly string[]).includes(status);
}

interface SubmittedResume {
  resumeId: string | null;
  resumeVariantId: string | null;
}

const NO_RESUME: SubmittedResume = { resumeId: null, resumeVariantId: null };

/**
 * The agent reports these ids, so anything the user doesn't own is dropped. A variant's own
 * `resumeId` wins over a reported one so the two can never disagree.
 */
async function resolveSubmittedResume(
  prisma: PrismaClient,
  userId: string,
  data: CampaignJobResultInput,
): Promise<SubmittedResume> {
  if (data.resumeVariantId) {
    const variant = await prisma.resumeVariant.findFirst({
      where: { id: data.resumeVariantId, resume: { userId } },
      select: { id: true, resumeId: true },
    });
    if (variant) return { resumeId: variant.resumeId, resumeVariantId: variant.id };
  }
  if (data.resumeId) {
    const resume = await prisma.resume.findFirst({
      where: { id: data.resumeId, userId },
      select: { id: true },
    });
    if (resume) return { resumeId: resume.id, resumeVariantId: null };
  }
  return NO_RESUME;
}

/** Records an idempotent terminal job result and, when applied, its Application and documents. */
export async function writeJobResult(
  prisma: PrismaClient,
  userId: string,
  campaignId: string,
  key: string,
  data: CampaignJobResultInput,
) {
  const existing = await findOwned(
    (where) => prisma.job.findFirst({ where, include: { campaign: { select: { source: true } } } }),
    { campaignId, key, campaign: { userId } },
    "Campaign job",
  );
  const { source } = existing.campaign;

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
    return { campaignJob: existing, application, source, changed: false };
  }

  // The contract requires `appliedAt` exactly when the outcome is applied.
  const appliedAt = data.outcome === "applied" && data.appliedAt ? new Date(data.appliedAt) : null;
  // Read outside the transaction: rows it never writes need not sit in its lock window.
  const submitted = appliedAt ? await resolveSubmittedResume(prisma, userId, data) : NO_RESUME;

  return prisma.$transaction(async (tx) => {
    const changed = await tx.job.updateMany({
      where: { campaignId, key, status: { notIn: [...CAMPAIGN_JOB_TERMINAL_OUTCOMES] } },
      data: {
        status: data.outcome,
        appliedAt,
        failReason: data.outcome === "failed" ? data.failReason : null,
        skipReason: data.outcome === "skipped" ? data.skipReason : null,
        retryNotes: data.retryNotes,
        matchScore: data.matchScore,
        // The agent lived to report, so this attempt is accounted for; a stale stamp would make a
        // later, unrelated crash read as "maybe submitted" and 409 the normal bail-out.
        submitAttemptedAt: null,
      },
    });
    const job = await tx.job.findUniqueOrThrow({ where: { campaignId_key: { campaignId, key } } });
    if (changed.count === 0 && job.status !== data.outcome) {
      throw conflict(`Job already finished with outcome ${job.status}.`);
    }

    let application: Application | null = null;
    if (appliedAt) {
      const logApplied = {
        create: { kind: "status_change", toStatus: "applied", source: "campaign" },
      } as const;
      application = await tx.application.upsert({
        where: { userId_url: { userId, url: canonicalizeJobUrl(job.url) } },
        // A repost reuses this row, so the date has to move: the duplicate window measures from
        // it. A result already recorded (`count === 0`) must not, or the retry logs a second event.
        update: changed.count === 0 ? {} : { appliedAt, events: logApplied, ...submitted },
        create: {
          userId,
          url: canonicalizeJobUrl(job.url),
          title: job.title,
          company: job.company,
          location: job.location,
          board: job.board,
          source,
          campaignId,
          matchScore: job.matchScore,
          matchReason: job.matchReason,
          appliedAt,
          events: logApplied,
          ...submitted,
        },
      });

      // Marks the variant used, which the resume page's prune filter reads. A reused variant keeps
      // its first link: the application it was created for.
      if (submitted.resumeVariantId) {
        await tx.resumeVariant.updateMany({
          where: { id: submitted.resumeVariantId, applicationId: null },
          data: { applicationId: application.id },
        });
      }

      // The letter is written before this row exists, so link it by the url it recorded.
      await tx.coverLetter.updateMany({
        where: { jobUrl: job.url, applicationId: null, userId },
        data: { applicationId: application.id },
      });
    }

    return { campaignJob: job, application, source, changed: changed.count > 0 };
  });
}
