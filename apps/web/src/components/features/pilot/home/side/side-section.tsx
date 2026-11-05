import type { ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

interface SideSectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function SideSection(props: SideSectionProps): ReactElement {
  const { title, action, children } = props;
  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="overline" color="textSecondary">
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Stack>
  );
}
