"use client";

import type { ReactNode } from "react";
import { Chip } from "@mui/material";
import type { SseConnectionStatus } from "@/hooks/use-sse-channel";

interface LiveStatusChipProps {
  status: SseConnectionStatus;
}

/** Hidden until the stream has been up at least once. */
export function LiveStatusChip(props: LiveStatusChipProps): ReactNode {
  const { status } = props;
  if (status === "open") {
    return <Chip variant="outlined" color="success" label="Live" />;
  }
  if (status === "reconnecting") {
    return <Chip color="warning" label="Reconnecting…" />;
  }
  return null;
}
