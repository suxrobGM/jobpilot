"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Badge } from "@mui/material";
import { useOpenQuestions } from "./use-open-questions";

/** Wraps a nav icon with the live open-question count; renders nothing extra when zero. */
export function QuestionBadge(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const { count } = useOpenQuestions();
  return (
    <Badge badgeContent={count} color="error" overlap="circular" max={99}>
      {children}
    </Badge>
  );
}
