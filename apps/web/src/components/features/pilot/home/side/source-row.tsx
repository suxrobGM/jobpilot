import type { ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

interface SourceRowProps {
  label: string;
  detail: string;
  action: ReactNode;
}

export function SourceRow(props: SourceRowProps): ReactElement {
  const { label, detail, action } = props;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="captionMuted" noWrap title={detail}>
          {detail}
        </Typography>
      </Stack>
      {action}
    </Stack>
  );
}
