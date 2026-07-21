"use client";

import type { ReactElement } from "react";
import type { JobListingStatus } from "@jobpilot/contracts/job-listing";
import { ColorChip } from "@/components/ui/display";

const STATUS_COLOR: Record<JobListingStatus, "primary" | "default"> = {
  published: "primary",
  hidden: "default",
};

interface ListingStatusChipProps {
  status: JobListingStatus;
}

export function ListingStatusChip(props: ListingStatusChipProps): ReactElement {
  const { status } = props;
  return <ColorChip value={status} colors={STATUS_COLOR} />;
}
