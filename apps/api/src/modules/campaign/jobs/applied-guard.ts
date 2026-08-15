import { ErrorCodes, HttpError } from "@/common/errors";
import {
  type AppliedDuplicate,
  type DuplicateReader,
  duplicateSkipReason,
  findAppliedDuplicate,
} from "@/modules/application/duplicate";

interface GuardedJob {
  campaignId: string;
  key: string;
  url: string;
  title: string;
  company: string;
}

/** Carries the refused job so the caller can record it `skipped` after its transaction rolls back. */
export class AlreadyAppliedError extends HttpError {
  constructor(
    readonly job: { campaignId: string; key: string },
    readonly duplicate: AppliedDuplicate,
  ) {
    super(
      ErrorCodes.CONFLICT,
      `${duplicateSkipReason(duplicate)}: this profile applied to "${duplicate.application.title}" at ${duplicate.application.company} on ${duplicate.application.appliedAt.toISOString().slice(0, 10)}. The job has been recorded as skipped with this reason; do not apply again.`,
      409,
    );
    this.name = "AlreadyAppliedError";
  }
}

/**
 * Refuses to move a job into `applying` when this profile already applied to it. The skills' own
 * `/applied/check` call is advice a model can skip, and `@@unique([userId, url])` only dedupes the
 * record once the second application has already landed with the employer.
 *
 * Refusing alone leaves the job `approved`, so callers pair this with
 * `CampaignJobService.skippingDuplicates`.
 */
export async function assertNotAlreadyApplied(
  db: DuplicateReader,
  userId: string,
  job: GuardedJob,
): Promise<void> {
  const duplicate = await findAppliedDuplicate(db, userId, {
    url: job.url,
    title: job.title,
    company: job.company,
  });
  if (!duplicate) {
    return;
  }
  throw new AlreadyAppliedError({ campaignId: job.campaignId, key: job.key }, duplicate);
}
