"use client";

import type { ReactNode } from "react";
import type { ChipProps } from "@mui/material";
import { ColorChip } from "@/components/ui/display";
import type { SseConnectionStatus } from "@/lib/sse/client";

type LiveStatus = Extract<SseConnectionStatus, "open" | "reconnecting">;

const STATUS_COLOR: Record<LiveStatus, ChipProps["color"]> = {
  open: "success",
  reconnecting: "warning",
};

const STATUS_LABEL: Record<LiveStatus, string> = {
  open: "Live",
  reconnecting: "Reconnecting…",
};

/** open is outlined, reconnecting is filled - matches the pre-ColorChip markup. */
const STATUS_VARIANT: Record<LiveStatus, ChipProps["variant"]> = {
  open: "outlined",
  reconnecting: "filled",
};

interface LiveStatusChipProps {
  status: SseConnectionStatus;
}

/** Connection badge for live pilot feeds; hidden until the stream has been up at least once. */
export function LiveStatusChip(props: LiveStatusChipProps): ReactNode {
  const { status } = props;
  if (status === "idle" || status === "connecting") {
    return null;
  }
  return (
    <ColorChip
      value={status}
      colors={STATUS_COLOR}
      label={STATUS_LABEL[status]}
      variant={STATUS_VARIANT[status]}
      size="small"
    />
  );
}
