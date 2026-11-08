import type { ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

interface SourceRowProps {
  label: string;
  detail: string;
  /** What the source is, on hover. */
  hint?: string;
  action?: ReactNode;
}

export function SourceRow(props: SourceRowProps): ReactElement {
  const { label, detail, hint, action } = props;
  return (
    <Stack direction="row" spacing={1} title={hint} sx={{ alignItems: "center", minHeight: 30 }}>
      <Typography variant="body2" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2Muted" noWrap title={detail} sx={{ flex: 1, minWidth: 0 }}>
        {detail}
      </Typography>
      {action}
    </Stack>
  );
}
