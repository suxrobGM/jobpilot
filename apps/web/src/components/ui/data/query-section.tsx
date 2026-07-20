"use client";

import type { ReactNode } from "react";
import { Button, LinearProgress, Stack, Typography } from "@mui/material";

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

/**
 * Loading / error / empty / content body for a section fed by a query. Callers keep
 * their own SectionCard so the title and actions stay theirs.
 */
export function QuerySection(props: QuerySectionProps): ReactNode {
  const { isLoading, isError, onRetry, errorTitle, isEmpty, empty, children } = props;

  if (isLoading) {
    return <LinearProgress />;
  }

  if (isError) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="body2Muted">{errorTitle ?? "Couldn't load this section."}</Typography>
        {onRetry && (
          <Button variant="text" size="small" onClick={onRetry}>
            Retry
          </Button>
        )}
      </Stack>
    );
  }

  return isEmpty ? empty : children;
}
