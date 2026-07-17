"use client";

import type { ReactNode } from "react";
import { Chip } from "@mui/material";
import type { SseConnectionStatus } from "@/lib/sse/client";

interface LiveStatusChipProps {
  status: SseConnectionStatus;
}

/** Connection badge for live pilot feeds; hidden until the stream has been up at least once. */
export function LiveStatusChip(props: LiveStatusChipProps): ReactNode {
  const { status } = props;
  if (status === "open") {
    return <Chip size="small" variant="outlined" color="success" label="Live" />;
  }
  if (status === "reconnecting") {
    return <Chip size="small" color="warning" label="Reconnecting…" />;
  }
  return null;
}
