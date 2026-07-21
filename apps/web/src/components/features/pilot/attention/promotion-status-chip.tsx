"use client";

import type { ReactElement } from "react";
import type { PromotionStatus } from "@jobpilot/contracts/pilot";
import type { ChipProps } from "@mui/material";
import { ColorChip } from "@/components/ui/display";

const STATUS_COLOR: Record<PromotionStatus, ChipProps["color"]> = {
  draft: "warning",
  approved: "info",
  declined: "default",
  posted: "success",
  failed: "error",
  skipped: "default",
  expired: "default",
};

interface PromotionStatusChipProps {
  status: PromotionStatus;
}

export function PromotionStatusChip(props: PromotionStatusChipProps): ReactElement {
  const { status } = props;
  return (
    <ColorChip
      value={status}
      colors={STATUS_COLOR}
      variant="filled"
      sx={{ textTransform: "capitalize" }}
    />
  );
}
