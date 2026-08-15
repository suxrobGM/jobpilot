import { conflict } from "@/common/errors";
import {
  type DuplicateReader,
  duplicateSkipReason,
  findAppliedDuplicate,
} from "@/modules/application/duplicate";

/** The job fields the duplicate rule reads. */
interface GuardedJob {
  url: string;
  title: string;
  company: string;
}

/**
 * Refuses to move a job into `applying` when this profile already applied to it.
 *
 * The apply skills are told to call `/applied/check` first, but that is advice a model can skip,
 * and a duplicate reaching the browser means a second real application lands in an employer's
 * inbox - the `@@unique([userId, url])` row guard only dedupes the record, after the fact. Both
 * routes into `applying` (the pilot claim and the campaign PATCH) run this, so the block does not
 * depend on which flow is driving.
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

  // Carries the reason verbatim so the caller can write the skip without restating the rule.
  throw conflict(
    `${duplicateSkipReason(duplicate)}: this profile applied to "${duplicate.application.title}" at ${duplicate.application.company} on ${duplicate.application.appliedAt.toISOString().slice(0, 10)}. Record the job as skipped with this reason instead of applying again.`,
  );
}
