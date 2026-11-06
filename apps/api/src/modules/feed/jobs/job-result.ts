import type { JobResultInput, JobStatus } from "@jobpilot/contracts/feed";
import { JOB_TERMINAL_OUTCOMES } from "@jobpilot/contracts/feed";
import { conflict, findOwned } from "@/common/errors";
import type {
  Application,
  ApplicationSource,
  FeedKind,
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { JOB_INCLUDE, type JobRow } from "./job-row";

export function isTerminalJob(status: JobStatus): boolean {
  return (JOB_TERMINAL_OUTCOMES as readonly string[]).includes(status);
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
  data: JobResultInput,
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

/** How an application from this kind of feed was made. */
const APPLICATION_SOURCES: Record<FeedKind, ApplicationSource> = {
  search: "auto_apply",
  job_alerts: "auto_apply",
  research: "auto_apply",
  links: "apply",
  manual: "apply",
  upwork: "search",
  networking: "networking",
};

interface AppliedResult {
  userId: string;
  source: ApplicationSource;
  appliedAt: Date;
  submitted: SubmittedResume;
  /** False when this result was already recorded, so a retry must not log a second event. */
  firstWrite: boolean;
}

/** Upserts the Application for an applied job and links the documents sent with it. */
async function recordApplication(
  tx: Prisma.TransactionClient,
  job: JobRow,
  { userId, source, appliedAt, submitted, firstWrite }: AppliedResult,
): Promise<Application> {
  const logApplied = {
    create: { kind: "status_change", toStatus: "applied", source: "feed" },
  } as const;
  const application = await tx.application.upsert({
    where: { userId_url: { userId, url: job.url } },
    // A repost reuses this row, so the date has to move: the duplicate window measures from it.
    update: firstWrite ? { appliedAt, events: logApplied, ...submitted } : {},
    create: {
      userId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      boardId: job.boardId,
      source,
      feedId: job.feedId,
      jobId: job.id,
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

  // The letter is written before this row exists, so link it by the url; both sides are
  // normalized on write.
  await tx.coverLetter.updateMany({
    where: { jobUrl: job.url, applicationId: null, userId },
    data: { applicationId: application.id },
  });
  return application;
}

/** Records an idempotent terminal job result and, when applied, its Application and documents. */
export async function writeJobResult(
  prisma: PrismaClient,
  userId: string,
  feedId: string,
  key: string,
  data: JobResultInput,
) {
  const existing = await findOwned(
    (where) =>
      prisma.job.findFirst({
        where,
        include: { ...JOB_INCLUDE, feed: { select: { kind: true } } },
      }),
    { feedId, key, userId },
    "Feed job",
  );

  if (isTerminalJob(existing.status)) {
    if (existing.status !== data.outcome) {
      throw conflict(`Job already finished with outcome ${existing.status}.`);
    }
    const application =
      data.outcome === "applied"
        ? await prisma.application.findUnique({
            where: { userId_url: { userId, url: existing.url } },
          })
        : null;
    return { job: existing, application, changed: false };
  }

  // The contract requires `appliedAt` exactly when the outcome is applied.
  const appliedAt = data.outcome === "applied" && data.appliedAt ? new Date(data.appliedAt) : null;
  // Read outside the transaction: rows it never writes need not sit in its lock window.
  const submitted = appliedAt ? await resolveSubmittedResume(prisma, userId, data) : NO_RESUME;
  const source = APPLICATION_SOURCES[existing.feed.kind];

  return prisma.$transaction(async (tx) => {
    const changed = await tx.job.updateMany({
      where: { feedId, key, status: { notIn: [...JOB_TERMINAL_OUTCOMES] } },
      data: {
        status: data.outcome,
        appliedAt,
        failReason: data.outcome === "failed" ? data.failReason : null,
        skipReason: data.outcome === "skipped" ? data.skipReason : null,
        retryNotes: data.retryNotes,
        matchScore: data.matchScore,
      },
    });
    const job = await tx.job.findUniqueOrThrow({
      where: { feedId_key: { feedId, key } },
      include: JOB_INCLUDE,
    });
    if (changed.count === 0 && job.status !== data.outcome) {
      throw conflict(`Job already finished with outcome ${job.status}.`);
    }

    const firstWrite = changed.count > 0;
    const application = appliedAt
      ? await recordApplication(tx, job, { userId, source, appliedAt, submitted, firstWrite })
      : null;
    return { job, application, changed: firstWrite };
  });
}
