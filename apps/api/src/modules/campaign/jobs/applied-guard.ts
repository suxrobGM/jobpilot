import { conflict, ErrorCodes, HttpError } from "@/common/errors";
import type { Job, Prisma } from "@/generated/prisma/client";
import {
  type AppliedDuplicate,
  type DuplicateReader,
  duplicateSkipReason,
  findAppliedDuplicate,
} from "@/modules/application/duplicate";
import { findInFlightDuplicate, type InFlightReader } from "./in-flight";

/** Wider than a read: the guard writes the skip alongside the duplicate scan. */
export type GuardTransaction = DuplicateReader &
  InFlightReader &
  Pick<Prisma.TransactionClient, "job">;

interface GuardedJob {
  campaignId: string;
  key: string;
  url: string;
  title: string;
  company: string;
}

function refusalMessage(duplicate: AppliedDuplicate, recorded: boolean): string {
  const { title, company, appliedAt } = duplicate.application;
  const day = appliedAt.toISOString().slice(0, 10);
  const tail = recorded ? " The job has been recorded as skipped with this reason;" : "";
  return `${duplicateSkipReason(duplicate)}: this profile applied to "${title}" at ${company} on ${day}.${tail} do not apply again.`;
}

export class AlreadyAppliedError extends HttpError {
  constructor(
    readonly duplicate: AppliedDuplicate,
    /** Null only when a concurrent writer moved the job before the guard could skip it. */
    readonly skipped: Job | null,
  ) {
    super(ErrorCodes.CONFLICT, refusalMessage(duplicate, skipped !== null), 409);
    this.name = "AlreadyAppliedError";
  }
}

/**
 * Refuses a move into `applying` when this profile already applied, recording the job `skipped` in
 * the caller's transaction - left `approved` it is offered again by every following agenda.
 *
 * The skills' own `/applied/check` is advice a model can skip, and `@@unique([userId, url])` only
 * dedupes the record once the second application has already landed with the employer.
 *
 * The in-flight pass runs first and is deliberately *not* recorded as a skip: the other worker may
 * still fail, and a posting nobody applied to must stay approved.
 */
export async function skipIfAlreadyApplied(
  tx: GuardTransaction,
  userId: string,
  job: GuardedJob,
): Promise<AlreadyAppliedError | null> {
  const inFlight = await findInFlightDuplicate(tx, userId, job);
  if (inFlight) {
    throw conflict(
      `Already applying: another worker holds "${inFlight.title}" at ${inFlight.company} (${inFlight.campaignId}/${inFlight.key}). Record this job as skipped with reason "Already applied (in-flight)" instead of applying alongside it.`,
    );
  }

  const duplicate = await findAppliedDuplicate(tx, userId, job);
  if (!duplicate) {
    return null;
  }

  const [skipped] = await tx.job.updateManyAndReturn({
    where: { campaignId: job.campaignId, key: job.key },
    data: { status: "skipped", skipReason: duplicateSkipReason(duplicate) },
  });
  return new AlreadyAppliedError(duplicate, skipped ?? null);
}
