"use client";

import type { ReactElement } from "react";
import type { PilotRequest } from "@jobpilot/contracts/pilot";
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

interface RequestRowProps {
  request: PilotRequest;
}

/** Work the user asked for, as a one-liner that follows its run; queued work can still be called off. */
export function RequestRow(props: RequestRowProps): ReactElement {
  const { request } = props;
  const cancel = useApiMutation(() => api.pilot.requests({ id: request.id }).cancel.post(), {
    invalidate: [pilotQueries.threadAll],
  });

  return (
    <TurnLine>
      <PlaylistAddCheck fontSize="sm" color="action" />
      <Typography variant="captionMuted" sx={{ flex: 1, minWidth: 0 }}>
        {`You asked: ${request.title} · ${STATUS_LABELS[request.status]}`}
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
