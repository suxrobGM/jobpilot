import type { PropsWithChildren, ReactElement } from "react";
import { Box } from "@mui/material";
import { AppShell } from "@/components/layout";

export default function DashboardLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <AppShell>
      <Box
        sx={{
          flex: "1 0 auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>
    </AppShell>
  );
}
