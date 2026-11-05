"use client";

import type { ReactElement } from "react";
import { Button, Stack, Typography } from "@mui/material";

interface QueryErrorProps {
  title?: string;
  onRetry?: () => void;
}

export function QueryError(props: QueryErrorProps): ReactElement {
  const { title = "Couldn't load this section.", onRetry } = props;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography variant="body2Muted">{title}</Typography>
      {onRetry && (
        <Button variant="text" size="small" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Stack>
  );
}
