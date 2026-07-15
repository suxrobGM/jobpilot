"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Badge } from "@mui/material";
import { useOpenEscalations } from "./use-open-escalations";

/** Wraps a nav icon with the live open-escalation count; renders nothing extra when zero. */
export function EscalationBadge(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const { count } = useOpenEscalations();
  return (
    <Badge badgeContent={count} color="error" overlap="circular" max={99}>
      {children}
    </Badge>
  );
}
