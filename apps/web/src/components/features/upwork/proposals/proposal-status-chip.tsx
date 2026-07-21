"use client";

import type { ReactElement } from "react";
import type { UpworkProposalStatus } from "@jobpilot/contracts/upwork";
import type { ChipProps } from "@mui/material";
import { ColorChip } from "@/components/ui/display";
import { STATUS_COLOR, STATUS_LABEL } from "./proposal-status";

interface ProposalStatusChipProps {
  status: UpworkProposalStatus;
  size?: ChipProps["size"];
}

export function ProposalStatusChip(props: ProposalStatusChipProps): ReactElement {
  const { status, size } = props;
  return (
    <ColorChip value={status} colors={STATUS_COLOR} label={STATUS_LABEL[status]} size={size} />
  );
}
