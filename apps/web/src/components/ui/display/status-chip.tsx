"use client";

import type { ReactElement } from "react";
import { Chip, type ChipProps } from "@mui/material";
import { type StatusDomain, type StatusValue, statusColor, statusLabel } from "./status-styles";

interface StatusChipProps<D extends StatusDomain> {
  domain: D;
  value: StatusValue<D>;
  variant?: ChipProps["variant"];
  size?: ChipProps["size"];
  sx?: ChipProps["sx"];
}

export function StatusChip<D extends StatusDomain>(props: StatusChipProps<D>): ReactElement {
  const { domain, value, variant = "outlined", size, sx } = props;
  return (
    <Chip
      size={size}
      variant={variant}
      label={statusLabel(domain, value)}
      color={statusColor(domain, value)}
      sx={sx}
    />
  );
}
