import type { ReactNode } from "react";
import { Chip } from "@mui/material";
import type { JobListingSummaryDto } from "@/api/types";
import { formatRelativeTime } from "@/utils/format";

interface RemoteBadgeProps {
  job: Pick<JobListingSummaryDto, "remote" | "location">;
}

/** "United States (Remote)" already says it; a badge beside it would repeat it. */
export function RemoteBadge(props: RemoteBadgeProps): ReactNode {
  const { job } = props;
  const location = job.location ?? "";
  if (!job.remote || location.toLowerCase().includes("remote")) {
    return null;
  }
  return <Chip label="Remote" color="success" variant="outlined" />;
}

function boardsLabel(boards: readonly string[]): string {
  if (boards.length <= 2) {
    return boards.join(" · ");
  }
  return `${boards[0]} +${boards.length - 1}`;
}

export function jobMetaLine(job: Pick<JobListingSummaryDto, "boards" | "lastSeenAt">): string {
  return [boardsLabel(job.boards), `Seen ${formatRelativeTime(job.lastSeenAt)} ago`]
    .filter(Boolean)
    .join(" · ");
}
