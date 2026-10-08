import {
  INTERRUPTED_REASON,
  MAYBE_SUBMITTED_REASON,
  RECOVERY_ANSWERS,
} from "@jobpilot/contracts/campaign";
import type { PilotQuestion, Prisma } from "@/generated/prisma/client";

type RecoveryWriter = Pick<Prisma.TransactionClient, "job" | "pilotQuestion">;

/**
 * Rows parked per pass. Callers pass an interactive transaction (5s default budget) and each parked
 * job costs a question write; parking takes a job out of `applying`, so a backlog drains over passes.
 */
const RECOVERY_BATCH = 25;

/**
 * Long, because the honest answer often means checking an inbox. An ignored question then skips
 * the job via the expiry sweep, which loses a posting but can never send a second application.
 */
const RECOVERY_QUESTION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Hands every interrupted `applying` job to the user rather than retrying it, and returns the
 * questions it raised for the caller to publish once its transaction commits.
 *
 * Unstamped jobs are parked too: the agent does not reliably stamp the submit, so "unstamped" means
 * "no information", not "nothing was sent". A duplicate application cannot be undone; a needless
 * question costs one glance. The question's expiry keeps an ignored one from wedging the campaign.
 */
export async function recoverApplyingJobs(
  db: RecoveryWriter,
  userId: string,
  where: Prisma.JobWhereInput,
): Promise<PilotQuestion[]> {
  // Read before write: updateMany cannot say which rows it touched, and each needs its own
  // question. Sequential throughout - Prisma does not run concurrent queries on one transaction.
  const interrupted = await db.job.findMany({
    where,
    take: RECOVERY_BATCH,
    select: { campaignId: true, key: true, submitAttemptedAt: true },
  });
  if (interrupted.length === 0) return [];

  // Scope the writes to the rows just read: an uncapped `where` would park jobs this pass never
  // saw, leaving them with no question. `AND`, since the callers' `where` carries its own `OR`/`NOT`.
  const refsOf = (rows: typeof interrupted) =>
    rows.map((job) => ({ campaignId: job.campaignId, key: job.key }));
  const stamped = interrupted.filter((job) => job.submitAttemptedAt !== null);
  const unstamped = interrupted.filter((job) => job.submitAttemptedAt === null);

  if (stamped.length > 0) {
    await db.job.updateMany({
      where: { AND: [where, { OR: refsOf(stamped) }] },
      data: { status: "needs_user", skipReason: MAYBE_SUBMITTED_REASON },
    });
  }
  if (unstamped.length > 0) {
    await db.job.updateMany({
      where: { AND: [where, { OR: refsOf(unstamped) }] },
      data: { status: "needs_user", skipReason: INTERRUPTED_REASON },
    });
  }

  // Ask about what was actually parked: a row that reached `applied` in between must not get an
  // unanswerable "did it go through?".
  const parked = await db.job.findMany({
    where: { campaign: { userId }, status: "needs_user", OR: refsOf(interrupted) },
    select: { campaignId: true, key: true, title: true, company: true, submitAttemptedAt: true },
  });
  if (parked.length === 0) return [];

  const subjectId = (job: { campaignId: string; key: string }) => `${job.campaignId}:${job.key}`;
  // A job parked, re-applied, then crashed again must not accumulate a second question.
  const open = await db.pilotQuestion.findMany({
    where: {
      userId,
      status: "open",
      subjectType: "job",
      subjectId: { in: parked.map(subjectId) },
    },
    select: { subjectId: true },
  });
  const asked = new Set(open.map((question) => question.subjectId));

  const expiresAt = new Date(Date.now() + RECOVERY_QUESTION_TTL_MS);
  const questions: PilotQuestion[] = [];
  for (const job of parked) {
    if (asked.has(subjectId(job))) continue;
    const midSubmit = job.submitAttemptedAt !== null;
    questions.push(
      await db.pilotQuestion.create({
        data: {
          userId,
          kind: "choice",
          subjectType: "job",
          subjectId: subjectId(job),
          prompt: midSubmit
            ? `Did your application to ${job.company} for "${job.title}" go through? It was interrupted mid-submit, so re-applying might send a second one.`
            : `The application to ${job.company} for "${job.title}" was interrupted and never finished recording. Did it go through? Re-applying blind might send a second one.`,
          options: [...RECOVERY_ANSWERS],
          deepLink: `/campaigns/${job.campaignId}`,
          expiresAt,
        },
      }),
    );
  }
  return questions;
}
