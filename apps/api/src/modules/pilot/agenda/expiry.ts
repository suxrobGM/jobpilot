import type { PrismaClient } from "@/generated/prisma/client";
import { SERVER_SKIP_REASONS } from "../pilot.stats";
import {
  APPROVED_JOB_STALE_MS,
  GATHER_CAP,
  MAX_OPEN_APPLY_CLAIMS,
  STALE_APPLYING_MS,
} from "./constants";
import { parseJobPayload } from "./job-mutations";

function splitJobSubject(subjectId: string) {
  const separator = subjectId.indexOf(":");
  if (separator <= 0 || separator === subjectId.length - 1) {
    throw new Error(`Invalid job question subject: ${subjectId}`);
  }
  return {
    campaignId: subjectId.slice(0, separator),
    jobKey: subjectId.slice(separator + 1),
  };
}

/** Releases expired claims and questions, returning their subjects to a workable state. */
export async function runExpiry(prisma: PrismaClient, userId: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claims = await tx.pilotClaim.findMany({
      where: { userId, releasedAt: null, expiresAt: { lt: now } },
      take: GATHER_CAP,
      select: { id: true, kind: true, subjectId: true, payload: true },
    });

    if (claims.length) {
      await tx.pilotClaim.updateMany({
        where: { id: { in: claims.map((claim) => claim.id) }, releasedAt: null },
        data: { releasedAt: now, outcome: "expired" },
      });

      const jobRefs = claims
        .filter((claim) => claim.kind === "job.apply")
        .map((claim) => parseJobPayload(claim.payload));

      if (jobRefs.length) {
        await tx.job.updateMany({
          where: {
            status: "applying",
            campaign: { userId },
            OR: jobRefs.map((ref) => ({ campaignId: ref.campaignId, key: ref.jobKey })),
          },
          data: { status: "approved" },
        });
      }
    }

    // Stranded `applying` jobs: the terminal loop takes no claim, so a crashed session leaves the
    // job stuck (blocking finalize) with no recovery path. Revert stale ones not covered by an
    // open pilot claim; the pilot's own in-flight applies are protected by that claim check.
    const openApplyClaims = await tx.pilotClaim.findMany({
      where: { userId, kind: "job.apply", releasedAt: null, expiresAt: { gte: now } },
      take: MAX_OPEN_APPLY_CLAIMS,
      select: { payload: true },
    });
    const openApplyRefs = openApplyClaims.map((claim) => parseJobPayload(claim.payload));

    await tx.job.updateMany({
      where: {
        status: "applying",
        campaign: { userId },
        updatedAt: { lt: new Date(now.getTime() - STALE_APPLYING_MS) },
        NOT: openApplyRefs.map((ref) => ({ campaignId: ref.campaignId, key: ref.jobKey })),
      },
      data: { status: "approved" },
    });

    // Approved rows the pilot never reached. They outrank everything else on the agenda, so without
    // this a week-long pause spends the next run's first hours on postings that have since closed.
    await tx.job.updateMany({
      where: {
        status: "approved",
        campaign: { userId, createdBy: "pilot" },
        createdAt: { lt: new Date(now.getTime() - APPROVED_JOB_STALE_MS) },
      },
      data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.wentStale },
    });

    const questions = await tx.pilotQuestion.findMany({
      where: { userId, status: "open", expiresAt: { not: null, lt: now } },
      take: GATHER_CAP,
      select: { id: true, subjectType: true, subjectId: true },
    });
    if (!questions.length) return;

    await tx.pilotQuestion.updateMany({
      where: { id: { in: questions.map((question) => question.id) }, status: "open" },
      data: { status: "expired" },
    });

    const jobRefs = questions
      .filter((question) => question.subjectType === "job" && question.subjectId)
      .map((question) => splitJobSubject(question.subjectId as string));

    if (!jobRefs.length) return;

    await tx.job.updateMany({
      where: {
        status: "needs_user",
        campaign: { userId },
        OR: jobRefs.map((ref) => ({ campaignId: ref.campaignId, key: ref.jobKey })),
      },
      data: { status: "skipped", skipReason: SERVER_SKIP_REASONS.unanswered },
    });
  });
}
