import type { JobRef } from "@/modules/feed/jobs/applying";

/** Every producer and damper read must agree on a job's subject byte for byte. */
export function jobSubjectId(job: JobRef): string {
  return `${job.feedId}:${job.key}`;
}

/** The inverse of {@link jobSubjectId}, for question subjects written the same way. */
export function parseJobSubject(subjectId: string): JobRef {
  const separator = subjectId.indexOf(":");
  if (separator <= 0 || separator === subjectId.length - 1) {
    throw new Error(`Invalid job subject: ${subjectId}`);
  }
  return { feedId: subjectId.slice(0, separator), key: subjectId.slice(separator + 1) };
}
