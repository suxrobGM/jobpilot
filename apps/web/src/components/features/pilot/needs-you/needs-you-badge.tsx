"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Badge } from "@mui/material";
import { useNeedsYouCount } from "./use-needs-you";

export function NeedsYouBadge(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const count = useNeedsYouCount();
  return (
    <Badge badgeContent={count} invisible={count === 0}>
      {children}
    </Badge>
  );
}
