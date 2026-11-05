"use client";

import type { ReactNode } from "react";
import { LinearProgress } from "@mui/material";
import { QueryError } from "./query-error";

/** The slice of a `useQuery` result the section reads; combined queries pass a literal. */
export interface QueryState {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

interface QuerySectionProps {
  query: QueryState;
  errorTitle?: string;
  isEmpty: boolean;
  /** Rendered when the query succeeded with nothing to show. */
  empty: ReactNode;
  children: ReactNode;
}

/** Callers keep their own SectionCard so the title and actions stay theirs. */
export function QuerySection(props: QuerySectionProps): ReactNode {
  const { query, errorTitle, isEmpty, empty, children } = props;

  if (query.isLoading) {
    return <LinearProgress />;
  }

  if (query.isError) {
    return <QueryError title={errorTitle} onRetry={() => void query.refetch()} />;
  }

  return isEmpty ? empty : children;
}
