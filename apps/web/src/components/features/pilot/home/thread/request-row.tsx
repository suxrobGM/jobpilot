"use client";

import type { ReactElement } from "react";
import type { JobStatus } from "@jobpilot/contracts/feed";
import type { PilotRequest, PilotThreadJob } from "@jobpilot/contracts/pilot";
import { PlaylistAddCheck } from "@mui/icons-material";
import { Button, Typography } from "@mui/material";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { RelativeTime } from "@/components/ui/display";
import { TurnLine } from "./pilot-turn";

const STATUS_LABELS: Record<PilotRequest["status"], string> = {
  pending: "queued",
  running: "working on it",
  done: "done",
  failed: "didn't finish",
  cancelled: "cancelled",
};

/** A finished apply request says what happened to the job, not that the work ran. */
const JOB_RESULTS: Partial<Record<JobStatus, string>> = {
  applied: "applied",
  skipped: "skipped",
  failed: "didn't go through",
  needs_user: "waiting on you",
};

function statusLabel(request: PilotRequest, job: PilotThreadJob | null): string {
  const result = job && request.status === "done" ? JOB_RESULTS[job.status] : undefined;
  return result ?? STATUS_LABELS[request.status];
}

interface RequestRowProps {
  request: PilotRequest;
  /** The job an apply request named. */
  job: PilotThreadJob | null;
}

/** Work the user asked for, as a one-liner that follows its run; queued work can still be called off. */
export function RequestRow(props: RequestRowProps): ReactElement {
  const { request, job } = props;
  const title = job ? `Apply to ${job.title} at ${job.company}` : request.title;
  const cancel = useApiMutation(() => api.pilot.requests({ id: request.id }).cancel.post(), {
    invalidate: [pilotQueries.threadAll],
  });

  return (
    <TurnLine>
      <PlaylistAddCheck fontSize="sm" color="action" />
      <Typography variant="captionMuted" sx={{ flex: 1, minWidth: 0 }}>
        {`You asked: ${title} · ${statusLabel(request, job)}`}
      </Typography>
      {request.status === "pending" && (
        <Button
          size="small"
          color="inherit"
          loading={cancel.isPending}
          onClick={() => cancel.mutate()}
          sx={{ minWidth: 0, px: 1, py: 0 }}
        >
          Cancel
        </Button>
      )}
      <RelativeTime value={request.createdAt} sx={{ whiteSpace: "nowrap" }} />
    </TurnLine>
  );
}
