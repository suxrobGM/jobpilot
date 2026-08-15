import type { CampaignSummary } from "@jobpilot/contracts/campaign";
import { ErrorCodes, HttpError } from "@/common/errors";
import type { CampaignSource, Job, Prisma } from "@/generated/prisma/client";
import {
  type AppliedDuplicate,
  duplicateSkipReason,
  findAppliedDuplicate,
} from "@/modules/application/duplicate";
import { deriveCampaignSummary, type SummaryClient } from "../campaign.summary";

/** Wider than a read: the guard writes the skip and re-derives the summary it moved. */
export type GuardTransaction = SummaryClient & Pick<Prisma.TransactionClient, "application">;

interface GuardedJob {
  campaignId: string;
  key: string;
  url: string;
  title: string;
  company: string;
  campaign: { source: CampaignSource };
}

/** What the guard recorded, for the caller to publish once its transaction commits. */
export interface RecordedSkip {
  job: Job;
  summary: CampaignSummary;
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
    readonly skipped: RecordedSkip | null,
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
 */
export async function skipIfAlreadyApplied(
  tx: GuardTransaction,
  userId: string,
  job: GuardedJob,
): Promise<AlreadyAppliedError | null> {
  const duplicate = await findAppliedDuplicate(tx, userId, job);
  if (!duplicate) {
    return null;
  }

  const [skipped] = await tx.job.updateManyAndReturn({
    where: { campaignId: job.campaignId, key: job.key },
    data: { status: "skipped", skipReason: duplicateSkipReason(duplicate) },
  });
  if (!skipped) {
    return new AlreadyAppliedError(duplicate, null);
  }

  const summary = await deriveCampaignSummary(tx, job.campaignId, job.campaign.source);
  return new AlreadyAppliedError(duplicate, { job: skipped, summary });
}
