import {
  campaignConfigSchema,
  type JobBriefData,
  jobBriefSchema,
} from "@jobpilot/contracts/campaign";
import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { applyableJobWhere } from "@/modules/campaign/jobs/apply-guard";
import { normalizeCompanyName } from "@/modules/scoring/applied-duplicates";
import { GATHER_CAP, jobSubjectId, withoutRecentRuns } from "./run-history";

const storedBriefSchema = jobBriefSchema.nullable();

const WARM_INTRO_MIN_SCORE = 80;
/** "I just applied" outreach still lands this long after the apply. */
const WARM_INTRO_APPLIED_WINDOW_MS = 48 * HOUR_MS;
const BOARD_HEALTH_SCAN = 500;
const BOARD_HEALTH_MIN_FAILURES = 3;
const FAIL_REASON_CAP = 3;
/** A board still broken after a diagnosis waits for the user rather than burning a run each cycle. */
const BOARD_DIAGNOSE_COOLDOWN_MS = 24 * HOUR_MS;

type WarmContact = NonNullable<TaskPayload<"job.apply">["warmContacts"]>[number];

/** An approved or recently applied job, carrying what both apply and warm-intro tasks need. */
export interface TaskJob {
  campaignId: string;
  key: string;
  title: string;
  url: string;
  board: string | null;
  brief: JobBriefData | null;
  matchScore: number | null;
  company: string | null;
  resumeId?: string;
  warmContacts?: WarmContact[];
}

/** Approved jobs of in-progress campaigns, best match first. */
export async function gatherApprovedJobs(prisma: PrismaClient, userId: string): Promise<TaskJob[]> {
  const rows = await prisma.campaignJob.findMany({
    where: applyableJobWhere(userId),
    orderBy: { matchScore: "desc" },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      key: true,
      title: true,
      url: true,
      board: { select: { domain: true } },
      brief: true,
      matchScore: true,
      company: true,
      campaign: { select: { config: true } },
    },
  });
  return rows.map(({ campaign, board, ...job }) => ({
    ...job,
    board: board?.domain ?? null,
    brief: storedBriefSchema.parse(job.brief),
    resumeId: campaignConfigSchema.parse(campaign.config).resumeId,
  }));
}

/**
 * Strong approved matches plus recent applies. Applying outranks the intro, so without the applied
 * half the pool would drain before an intro ever fires.
 */
export async function gatherWarmIntroCandidates(
  prisma: PrismaClient,
  userId: string,
  now: Date,
  approvedJobs: TaskJob[],
): Promise<TaskJob[]> {
  const applied = await prisma.campaignJob.findMany({
    where: {
      status: "applied",
      appliedAt: { gte: new Date(now.getTime() - WARM_INTRO_APPLIED_WINDOW_MS) },
      matchScore: { gte: WARM_INTRO_MIN_SCORE },
      userId,
    },
    orderBy: { matchScore: "desc" },
    take: GATHER_CAP,
    select: {
      campaignId: true,
      key: true,
      title: true,
      url: true,
      matchScore: true,
      company: true,
    },
  });
  const candidates: TaskJob[] = [
    ...approvedJobs.filter((job) => (job.matchScore ?? 0) >= WARM_INTRO_MIN_SCORE),
    ...applied.map((job) => ({ ...job, board: null, brief: null })),
  ];
  const startable = await withoutRecentRuns(
    prisma,
    { userId, taskType: "networking.warmIntro", now, cooldownMs: WARM_INTRO_APPLIED_WINDOW_MS },
    candidates,
    jobSubjectId,
  );
  return startable.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}

/** Names same-company contacts on each job, at any score: one read covers every job. */
export async function attachWarmContacts(
  prisma: PrismaClient,
  userId: string,
  jobs: TaskJob[],
): Promise<void> {
  const withCompany = jobs.filter((job) => job.company);
  if (withCompany.length === 0) return;

  const rows = await prisma.contact.findMany({
    where: { userId, email: { not: null }, company: { not: null } },
    orderBy: { createdAt: "desc" },
    take: GATHER_CAP,
    select: { id: true, name: true, title: true, email: true, company: true },
  });
  const contacts = rows
    .map(({ company, ...contact }) => ({ contact, company: normalizeCompanyName(company ?? "") }))
    .filter(({ company }) => company.length > 0);

  for (const job of withCompany) {
    const target = normalizeCompanyName(job.company ?? "");
    if (!target) continue;
    const matches = contacts
      .filter(({ company }) => company.includes(target) || target.includes(company))
      .map(({ contact }) => contact);
    if (matches.length > 0) job.warmContacts = matches;
  }
}

/** Boards whose latest apply outcomes are a failure streak, longest streak first. */
export async function gatherBoardDiagnoses(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<TaskPayload<"board.diagnose">[]> {
  const rows = await prisma.campaignJob.findMany({
    where: { status: { in: ["applied", "failed"] }, boardId: { not: null }, userId },
    orderBy: { createdAt: "desc" },
    take: BOARD_HEALTH_SCAN,
    select: {
      campaignId: true,
      key: true,
      url: true,
      board: { select: { id: true, domain: true } },
      status: true,
      failReason: true,
      campaign: { select: { status: true } },
    },
  });

  const unhealthy: TaskPayload<"board.diagnose">[] = [];
  for (const jobs of Map.groupBy(rows, (row) => row.board?.id).values()) {
    const { board } = jobs[0];
    if (!board) continue;
    const firstSuccess = jobs.findIndex((job) => job.status !== "failed");
    const failed = firstSuccess === -1 ? jobs : jobs.slice(0, firstSuccess);
    if (failed.length < BOARD_HEALTH_MIN_FAILURES) continue;

    // The agent retries the test job into the apply queue, which only reads in-progress campaigns.
    const probe = failed.find((job) => job.campaign.status === "in_progress");
    unhealthy.push({
      boardId: board.id,
      board: board.domain,
      consecutiveFailures: failed.length,
      recentFailReasons: failed
        .flatMap((job) => (job.failReason ? [job.failReason] : []))
        .slice(0, FAIL_REASON_CAP),
      testJob: probe ? { campaignId: probe.campaignId, jobKey: probe.key, url: probe.url } : null,
    });
  }
  const due = await withoutRecentRuns(
    prisma,
    { userId, taskType: "board.diagnose", now, cooldownMs: BOARD_DIAGNOSE_COOLDOWN_MS },
    unhealthy,
    (diagnosis) => diagnosis.boardId,
  );
  return due.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
}
