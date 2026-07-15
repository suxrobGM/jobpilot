import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";

/** Deps for the job-status mutations shared by expiry, lease grant, and release. */
export interface JobMutationDeps {
  prisma: PrismaClient;
  campaignJobs: CampaignJobService;
}

export function parsePayload(payload: string): { campaignId?: string; jobKey?: string } {
  return JSON.parse(payload) as { campaignId?: string; jobKey?: string };
}

export function jobRef(
  payload: { campaignId?: string; jobKey?: string },
  subjectId: string,
): { campaignId: string; jobKey: string } {
  return { campaignId: payload.campaignId ?? "", jobKey: payload.jobKey ?? subjectId };
}

/** Job escalation subjects are stored as `${campaignId}:${jobKey}`. */
function splitJobSubject(subjectId: string): { campaignId: string; jobKey: string } {
  const idx = subjectId.indexOf(":");
  return idx === -1
    ? { campaignId: subjectId, jobKey: "" }
    : { campaignId: subjectId.slice(0, idx), jobKey: subjectId.slice(idx + 1) };
}

export async function revertJobToApproved(
  { prisma, campaignJobs }: JobMutationDeps,
  profileId: string,
  campaignId: string,
  jobKey: string,
): Promise<void> {
  const job = await prisma.job.findFirst({
    where: { campaignId, key: jobKey, campaign: { profileId } },
    select: { status: true },
  });
  if (job?.status === "applying") {
    await campaignJobs.patchJob(profileId, campaignId, jobKey, { status: "approved" });
  }
}

async function skipParkedJob(
  { prisma, campaignJobs }: JobMutationDeps,
  profileId: string,
  subjectId: string,
): Promise<void> {
  const { campaignId, jobKey } = splitJobSubject(subjectId);
  if (!campaignId || !jobKey) return;
  const job = await prisma.job.findFirst({
    where: { campaignId, key: jobKey, campaign: { profileId } },
    select: { status: true },
  });
  if (job?.status === "needs_user") {
    await campaignJobs.recordJobResult(profileId, campaignId, jobKey, {
      outcome: "skipped",
      skipReason: "Escalation expired without an answer.",
    });
  }
}

async function expireLeases(deps: JobMutationDeps, profileId: string, now: Date): Promise<void> {
  const { prisma } = deps;
  const leases = await prisma.pilotLease.findMany({
    where: { profileId, releasedAt: null, expiresAt: { lt: now } },
  });
  if (leases.length === 0) return;
  await prisma.pilotLease.updateMany({
    where: { id: { in: leases.map((l) => l.id) } },
    data: { releasedAt: now, outcome: "expired" },
  });
  const reverts = leases
    .filter((l) => l.kind === "job.apply")
    .map((l) => jobRef(parsePayload(l.payload), l.subjectId))
    .filter((ref) => ref.campaignId)
    .map((ref) => revertJobToApproved(deps, profileId, ref.campaignId, ref.jobKey));
  await Promise.all(reverts);
}

async function expireEscalations(
  deps: JobMutationDeps,
  profileId: string,
  now: Date,
): Promise<void> {
  const { prisma } = deps;
  const escalations = await prisma.escalation.findMany({
    where: { profileId, status: "open", expiresAt: { not: null, lt: now } },
  });
  if (escalations.length === 0) return;
  await prisma.escalation.updateMany({
    where: { id: { in: escalations.map((e) => e.id) } },
    data: { status: "expired" },
  });
  const skips = escalations
    .filter((e) => e.subjectType === "job" && e.subjectId)
    .map((e) => skipParkedJob(deps, profileId, e.subjectId as string));
  await Promise.all(skips);
}

/**
 * Sweep overdue leases and escalations before compiling. An expired job lease
 * reverts its job to `approved`; an expired escalation whose job is parked in
 * `needs_user` is skipped through the campaign job service. The two passes are
 * independent, so they run in parallel. Runs first so the agenda reflects the cleanup.
 */
export async function runExpiry(
  deps: JobMutationDeps,
  profileId: string,
  now: Date,
): Promise<void> {
  await Promise.all([expireLeases(deps, profileId, now), expireEscalations(deps, profileId, now)]);
}
