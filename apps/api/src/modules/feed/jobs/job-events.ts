import { pilotChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { publish } from "@/common/sse";
import type { JobRow } from "./job-row";

type PublishedJob = Pick<JobRow, "feedId" | "key" | "status">;

export function publishJobAdded(userId: string, job: PublishedJob): void {
  publish(workspaceChannel, { userId }, { type: "job.created", feedId: job.feedId, key: job.key });
}

export function publishJobUpdated(userId: string, job: PublishedJob): void {
  publish(
    workspaceChannel,
    { userId },
    { type: "job.updated", feedId: job.feedId, key: job.key, status: job.status },
  );
}

/** Wakes the user's host, so a job they approve starts applying without waiting out the sleep. */
export function publishJobApproved(userId: string, job: PublishedJob): void {
  publish(pilotChannel, { userId }, { type: "job.approved", feedId: job.feedId, key: job.key });
}
