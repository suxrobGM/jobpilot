"use client";

import type { ReactElement } from "react";
import type { SxProps, Theme, TypographyProps } from "@mui/material";
import { Tooltip, Typography } from "@mui/material";
import { formatAbsoluteTime, formatRelativeTime } from "@/utils/format";

interface RelativeTimeProps {
  value: string | Date;
  variant?: TypographyProps["variant"];
  sx?: SxProps<Theme>;
}

/** Compact relative age ("3h ago") with the absolute local timestamp + timezone on hover. */
export function RelativeTime(props: RelativeTimeProps): ReactElement {
  const { value, variant = "captionMuted", sx } = props;
  return (
    <Tooltip title={formatAbsoluteTime(value)}>
      <Typography variant={variant} sx={sx}>
        {formatRelativeTime(value)} ago
      </Typography>
    </Tooltip>
  );
}
