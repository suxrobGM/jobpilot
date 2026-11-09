import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

interface AgentCardProps extends PropsWithChildren {
  title: string;
  description: ReactNode;
}

/** The shell every agent-drawer state card shares. */
export function AgentCard(props: AgentCardProps): ReactElement {
  const { title, description, children } = props;

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0, p: 2, overflowY: "auto" }}>
      <Stack spacing={0.5}>
        <Typography variant="body1Strong">{title}</Typography>
        <Typography variant="body2Muted">{description}</Typography>
      </Stack>
      {children}
    </Stack>
  );
}
