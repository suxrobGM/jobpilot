"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Badge } from "@mui/material";
import { useNeedsYou } from "./use-needs-you";

export function NeedsYouBadge(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return <Badge badgeContent={useNeedsYou().length}>{children}</Badge>;
}
