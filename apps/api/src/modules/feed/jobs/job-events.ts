import { workspaceChannel } from "@jobpilot/contracts/sse";
import { publish } from "@/common/sse";
import type { JobRow } from "./job-row";

export function publishJob(userId: string, job: JobRow, kind: "added" | "updated"): void {
  publish(
    workspaceChannel,
    { userId },
    {
      type: kind === "added" ? "job.created" : "job.updated",
      feedId: job.feedId,
      key: job.key,
      ...(kind === "updated" && { status: job.status }),
    },
  );
}
