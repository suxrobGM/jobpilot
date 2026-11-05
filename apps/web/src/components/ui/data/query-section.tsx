"use client";

import type { ReactNode } from "react";
import { LinearProgress } from "@mui/material";
import { QueryError } from "./query-error";

interface QuerySectionProps {
  isLoading: boolean;
  /** Required, not optional: a failed query rendering as "empty" is the bug this prevents. */
  isError: boolean;
  onRetry?: () => void;
  errorTitle?: string;
  isEmpty: boolean;
  /** Rendered when the query succeeded with nothing to show. */
  empty: ReactNode;
  children: ReactNode;
}

/** Callers keep their own SectionCard so the title and actions stay theirs. */
export function QuerySection(props: QuerySectionProps): ReactNode {
  const { isLoading, isError, onRetry, errorTitle, isEmpty, empty, children } = props;

  if (isLoading) {
    return <LinearProgress />;
  }

  if (isError) {
    return <QueryError title={errorTitle} onRetry={onRetry} />;
  }

  return isEmpty ? empty : children;
}
