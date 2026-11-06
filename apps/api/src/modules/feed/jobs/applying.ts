import { AUTO_APPLY_FEED_KINDS } from "@jobpilot/contracts/feed";
import { conflict } from "@/common/errors";
import type { Job, Prisma } from "@/generated/prisma/client";
import { assertNotDuplicateApply } from "./apply-guard";
import { JOB_INCLUDE, type JobRow } from "./job-row";

/** A live feed the pilot scores and applies from on its own. */
export const LIVE_AUTO_APPLY_FEED = {
  pausedAt: null,
  archivedAt: null,
  kind: { in: [...AUTO_APPLY_FEED_KINDS] },
} satisfies Prisma.FeedWhereInput;

export type JobRef = Pick<Job, "feedId" | "key">;

/** Jobs ready to apply to: the pilot's `job.apply` gather and its run-start re-check share this. */
export function applyableJobWhere(userId: string) {
  return {
    status: "approved",
    userId,
    feed: { pausedAt: null, archivedAt: null },
  } satisfies Prisma.JobWhereInput;
}

/** Moves an approved job into `applying` inside the caller's transaction; wrap it in `guardApply`. */
export async function startApplying(
  tx: Prisma.TransactionClient,
  userId: string,
  job: JobRef,
): Promise<JobRow> {
  const where = { ...applyableJobWhere(userId), ...job } satisfies Prisma.JobWhereInput;
  const target = await tx.job.findFirst({
    where,
    select: { url: true, title: true, company: true },
  });
  if (!target) throw conflict("Job is no longer approved.");
  await assertNotDuplicateApply(tx, userId, { ...target, ...job });

  // An empty result is the lost race.
  const [started] = await tx.job.updateManyAndReturn({
    where,
    data: { status: "applying" },
    include: JOB_INCLUDE,
  });
  if (!started) throw conflict("Job is no longer approved.");
  return started;
}

/** Hands `applying` jobs whose run ended without a result back to the queue. */
export async function revertApplyingJobs(
  tx: Prisma.TransactionClient,
  userId: string,
  jobs: JobRef[],
): Promise<void> {
  if (jobs.length === 0) return;
  await tx.job.updateMany({
    where: { status: "applying", userId, OR: jobs },
    data: { status: "approved" },
  });
}
