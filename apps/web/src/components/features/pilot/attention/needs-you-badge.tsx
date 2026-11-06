"use client";

import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { Badge, Typography } from "@mui/material";
import { useNeedsYouCount } from "./use-needs-you";

interface NeedsYouBadgeProps extends PropsWithChildren {
  /** A dot where a number has no room, like the collapsed sidebar. */
  variant?: "standard" | "dot";
}

export function NeedsYouBadge(props: NeedsYouBadgeProps): ReactElement {
  const { variant = "standard", children } = props;
  const count = useNeedsYouCount();
  return (
    <Badge badgeContent={count} variant={variant} invisible={count === 0}>
      {children}
    </Badge>
  );
}

/** The count at the end of an expanded nav row. */
export function NeedsYouCount(): ReactNode {
  const count = useNeedsYouCount();
  if (count === 0) {
    return null;
  }
  return (
    <Typography variant="caption" sx={{ color: "error.main", ml: "auto" }}>
      {count}
    </Typography>
  );
}
