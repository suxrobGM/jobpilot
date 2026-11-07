import type { ReactElement } from "react";
import type { PilotRequest } from "@jobpilot/contracts/pilot";
import { PlaylistAddCheck } from "@mui/icons-material";
import { Typography } from "@mui/material";
import { RelativeTime } from "@/components/ui/display";
import { TurnLine } from "./pilot-turn";

const STATUS_LABELS: Record<PilotRequest["status"], string> = {
  pending: "queued",
  running: "working on it",
  done: "done",
  failed: "didn't finish",
  cancelled: "stopped",
};

interface RequestRowProps {
  request: PilotRequest;
}

/** Work the user asked for, as a one-liner that follows its run. */
export function RequestRow(props: RequestRowProps): ReactElement {
  const { request } = props;
  return (
    <TurnLine>
      <PlaylistAddCheck fontSize="sm" color="action" />
      <Typography variant="captionMuted" sx={{ flex: 1, minWidth: 0 }}>
        {`You asked: ${request.title} · ${STATUS_LABELS[request.status]}`}
      </Typography>
      <RelativeTime value={request.createdAt} sx={{ whiteSpace: "nowrap" }} />
    </TurnLine>
  );
}
