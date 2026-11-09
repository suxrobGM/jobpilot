import type { TaskPayload } from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
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

const jobRefSchema = z.object({ feedId: z.string().min(1), jobKey: z.string().min(1) });

type JobPayload = Pick<TaskPayload<"job.apply">, "feedId" | "jobKey">;

/** Task payloads name the key `jobKey`; jobs name it `key`. */
export function toJobRef({ feedId, jobKey }: JobPayload): JobRef {
  return { feedId, key: jobKey };
}

/** The job a stored `job.apply` run payload points at. */
export function parseJobRef(payload: unknown): JobRef {
  return toJobRef(jobRefSchema.parse(payload));
}
