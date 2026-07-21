"use client";

import type { ReactElement } from "react";
import type { NetworkingMessageStatus } from "@jobpilot/contracts/networking";
import type { ChipProps } from "@mui/material";
import type { ContactDto } from "@/api/types";
import { ColorChip } from "@/components/ui/display";

const STATUS_COLOR: Record<NetworkingMessageStatus, ChipProps["color"]> = {
  draft: "default",
  approved: "info",
  sent: "primary",
  replied: "success",
  bounced: "warning",
  failed: "error",
  skipped: "default",
};

interface NetworkingStatusChipProps {
  status: NetworkingMessageStatus;
}

export function NetworkingStatusChip(props: NetworkingStatusChipProps): ReactElement {
  const { status } = props;
  return <ColorChip value={status} colors={STATUS_COLOR} />;
}

const CONNECTION_COLOR: Record<ContactDto["linkedinConnection"], "default" | "info" | "success"> = {
  none: "default",
  pending: "info",
  connected: "success",
};

interface NetworkingConnectionChipProps {
  connection: ContactDto["linkedinConnection"];
}

export function NetworkingConnectionChip(props: NetworkingConnectionChipProps): ReactElement {
  const { connection } = props;
  return <ColorChip value={connection} colors={CONNECTION_COLOR} />;
}
