import type { JobBriefData } from "@jobpilot/contracts/feed";
import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { HOUR_MS } from "@/common/date/buckets";
import type { CapExemptBasis, Prisma, PrismaClient } from "@/generated/prisma/client";
import { applyableJobWhere } from "@/modules/feed/jobs/applying";
import { toJob } from "@/modules/feed/jobs/job-row";
import { normalizeCompanyName } from "@/modules/scoring/applied-duplicates";
import { jobSubjectId } from "../../job-subject";
import { GATHER_CAP, withoutRecentRuns } from "../../runs/run-history";

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
  feedId: string;
  key: string;
  title: string;
  url: string;
  board: string | null;
  brief: JobBriefData | null;
  matchScore: number | null;
  company: string | null;
  capExemptBasis: CapExemptBasis | null;
  resumeId?: string;
  warmContacts?: WarmContact[];
}

const TASK_JOB_SELECT = {
  feedId: true,
  key: true,
  title: true,
  url: true,
  board: { select: { domain: true } },
  brief: true,
  matchScore: true,
  company: true,
  capExemptBasis: true,
  feed: { select: { resumeId: true } },
} satisfies Prisma.JobSelect;

type TaskJobRow = Prisma.JobGetPayload<{ select: typeof TASK_JOB_SELECT }>;

function toTaskJob(row: TaskJobRow): TaskJob {
  const { feed, board, ...job } = toJob(row);
  return {
    ...job,
    board: board?.domain ?? null,
    resumeId: feed.resumeId ?? undefined,
  };
}

/** Approved jobs of live feeds, best match first. */
export async function gatherApprovedJobs(prisma: PrismaClient, userId: string): Promise<TaskJob[]> {
  const rows = await prisma.job.findMany({
    where: applyableJobWhere(userId),
    orderBy: { matchScore: "desc" },
    take: GATHER_CAP,
    select: TASK_JOB_SELECT,
  });
  return rows.map(toTaskJob);
}

/** One approved job the user asked to apply to, whatever its feed's state. */
export async function findApprovedJob(
  prisma: PrismaClient,
  userId: string,
  feedId: string,
  key: string,
): Promise<TaskJob | null> {
  const row = await prisma.job.findFirst({
    where: { userId, feedId, key, status: "approved" },
    select: TASK_JOB_SELECT,
  });
  return row && toTaskJob(row);
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
  const applied = await prisma.job.findMany({
    where: {
      status: "applied",
      appliedAt: { gte: new Date(now.getTime() - WARM_INTRO_APPLIED_WINDOW_MS) },
      matchScore: { gte: WARM_INTRO_MIN_SCORE },
      userId,
    },
    orderBy: { matchScore: "desc" },
    take: GATHER_CAP,
    select: {
      feedId: true,
      key: true,
      title: true,
      url: true,
      matchScore: true,
      company: true,
    },
  });
  const candidates: TaskJob[] = [
    ...approvedJobs.filter((job) => (job.matchScore ?? 0) >= WARM_INTRO_MIN_SCORE),
    ...applied.map((job) => ({ ...job, board: null, brief: null, capExemptBasis: null })),
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
  const rows = await prisma.job.findMany({
    where: { status: { in: ["applied", "failed"] }, boardId: { not: null }, userId },
    orderBy: { createdAt: "desc" },
    take: BOARD_HEALTH_SCAN,
    select: {
      feedId: true,
      key: true,
      url: true,
      board: { select: { id: true, domain: true } },
      status: true,
      failReason: true,
      feed: { select: { pausedAt: true, archivedAt: true } },
    },
  });

  const unhealthy: TaskPayload<"board.diagnose">[] = [];
  for (const jobs of Map.groupBy(rows, (row) => row.board?.id).values()) {
    const { board } = jobs[0];
    if (!board) continue;
    const firstSuccess = jobs.findIndex((job) => job.status !== "failed");
    const failed = firstSuccess === -1 ? jobs : jobs.slice(0, firstSuccess);
    if (failed.length < BOARD_HEALTH_MIN_FAILURES) continue;

    // The agent retries the test job into the apply queue, which only reads live feeds.
    const probe = failed.find((job) => job.feed.pausedAt === null && job.feed.archivedAt === null);
    unhealthy.push({
      boardId: board.id,
      board: board.domain,
      consecutiveFailures: failed.length,
      recentFailReasons: failed
        .flatMap((job) => (job.failReason ? [job.failReason] : []))
        .slice(0, FAIL_REASON_CAP),
      testJob: probe ? { feedId: probe.feedId, jobKey: probe.key, url: probe.url } : null,
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
