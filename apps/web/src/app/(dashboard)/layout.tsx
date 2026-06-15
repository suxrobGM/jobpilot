import type { PropsWithChildren, ReactElement } from "react";
import { Box } from "@mui/material";
import { AutoApplyStopPill } from "@/components/features/campaigns";
import { AppShell } from "@/components/layout";

export default function DashboardLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <AppShell>
      <Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column", py: 3 }}>
        {children}
      </Box>
      <AutoApplyStopPill />
    </AppShell>
  );
}
